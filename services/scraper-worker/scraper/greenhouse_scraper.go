package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

type GreenhouseScraper struct {
	client  *http.Client
	repo    *repository.JobRepository
	limiter *rate.Limiter
}

type GreenhouseResponse struct {
	Jobs []struct {
		ID       int    `json:"id"`
		Title    string `json:"title"`
		Location struct {
			Name string `json:"name"`
		} `json:"location"`
		AbsoluteURL string    `json:"absolute_url"`
		UpdatedAt   time.Time `json:"updated_at"`
		Departments []struct {
			Name string `json:"name"`
		} `json:"departments"`
		Content string `json:"content"`
	} `json:"jobs"`
}

func NewGreenhouseScraper(repo *repository.JobRepository) *GreenhouseScraper {
	return &GreenhouseScraper{
		client:  &http.Client{Timeout: 30 * time.Second},
		repo:    repo,
		limiter: rate.NewLimiter(rate.Every(time.Second), 3), // 3 requests per second
	}
}

func (s *GreenhouseScraper) ScrapeCompany(ctx context.Context, company, boardToken string) error {
	log.Info().Str("company", company).Msg("Starting Greenhouse scrape")

	// Rate limit
	if err := s.limiter.Wait(ctx); err != nil {
		return err
	}

	url := fmt.Sprintf("https://boards-api.greenhouse.io/v1/boards/%s/jobs?content=true", boardToken)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
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

	var ghResp GreenhouseResponse
	if err := json.Unmarshal(body, &ghResp); err != nil {
		return fmt.Errorf("failed to parse JSON: %w", err)
	}

	log.Info().Int("count", len(ghResp.Jobs)).Str("company", company).Msg("Parsed Greenhouse jobs")

	for _, ghJob := range ghResp.Jobs {
		// Filter for internships
		if !isInternship(ghJob.Title) {
			continue
		}

		postedAt := ghJob.UpdatedAt

		job := models.Job{
			Source:          "greenhouse",
			SourceJobID:     fmt.Sprintf("gh-%s-%d", boardToken, ghJob.ID),
			SourceURL:       ghJob.AbsoluteURL,
			Title:           ghJob.Title,
			Company:         company,
			Location:        ghJob.Location.Name,
			EmploymentType:  "INTERNSHIP",
			DescriptionText: stripHTML(ghJob.Content),
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

	log.Info().Str("company", company).Msg("Completed Greenhouse scrape")
	return nil
}

func isInternship(title string) bool {
	lowerTitle := strings.ToLower(title)
	return strings.Contains(lowerTitle, "intern") ||
		strings.Contains(lowerTitle, "co-op") ||
		strings.Contains(lowerTitle, "coop")
}

func stripHTML(html string) string {
	// Remove HTML tags using regex
	re := regexp.MustCompile(`<[^>]*>`)
	text := re.ReplaceAllString(html, " ")
	// Clean up multiple spaces
	text = strings.Join(strings.Fields(text), " ")
	return strings.TrimSpace(text)
}
