package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
)

type WorkdayScraper struct {
	client *http.Client
	repo   *repository.JobRepository
}

type WorkdayResponse struct {
	Total int `json:"total"`
	Jobs  []struct {
		Title       string `json:"title"`
		ExternalURL string `json:"externalUrl"`
		Locations   []struct {
			City    string `json:"city"`
			Country string `json:"country"`
		} `json:"locations"`
		PostedOn string `json:"postedOn"`
	} `json:"jobPostings"`
}

func NewWorkdayScraper(repo *repository.JobRepository) *WorkdayScraper {
	return &WorkdayScraper{
		client: &http.Client{Timeout: 30 * time.Second},
		repo:   repo,
	}
}

func (s *WorkdayScraper) ScrapeCompany(ctx context.Context, company, workdayURL string) error {
	log.Info().Str("company", company).Msg("Starting Workday scrape")
	
	req, err := http.NewRequestWithContext(ctx, "GET", workdayURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "JobDog/1.0")
	
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch jobs: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}
	
	var workdayResp WorkdayResponse
	if err := json.Unmarshal(body, &workdayResp); err != nil {
		return fmt.Errorf("failed to parse JSON: %w", err)
	}
	
	log.Info().Int("count", len(workdayResp.Jobs)).Str("company", company).Msg("Parsed Workday jobs")
	
	for _, wdJob := range workdayResp.Jobs {
		location := ""
		if len(wdJob.Locations) > 0 {
			location = fmt.Sprintf("%s, %s", wdJob.Locations[0].City, wdJob.Locations[0].Country)
		}
		
		postedAt, _ := time.Parse("2006-01-02", wdJob.PostedOn)
		
		job := models.Job{
			Source:          "workday",
			SourceURL:       wdJob.ExternalURL,
			Title:           wdJob.Title,
			Company:         company,
			Location:        location,
			EmploymentType:  "FULL_TIME",
			DescriptionText: fmt.Sprintf("%s at %s", wdJob.Title, company),
			Status:          "ACTIVE",
			PostedAt:        &postedAt,
		}
		
		jobID, err := s.repo.UpsertJob(&job)
		if err != nil {
			log.Error().Err(err).Str("company", company).Msg("Failed to upsert job")
			continue
		}
		
		required, preferred := ExtractSkills(job.DescriptionText)
		
		profile := &models.JobRequirementProfile{
			JobID:            jobID,
			RequiredSkills:   required,
			PreferredSkills:  preferred,
			ExtractionMethod: "KEYWORD",
		}
		
		if err := s.repo.UpsertJobRequirementProfile(profile); err != nil {
			log.Error().Err(err).Str("job_id", jobID).Msg("Failed to upsert requirement profile")
		}
	}
	
	log.Info().Str("company", company).Msg("Completed Workday scrape")
	return nil
}
