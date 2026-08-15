package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

// AshbyScraper reads Ashby's public posting API.
//
// Ashby returns the whole board in one response — no pagination, no per-job
// detail fetch — and includes plain-text descriptions and compensation, so it is
// both the cheapest source to poll and the richest one we have.
type AshbyScraper struct {
	client  *http.Client
	repo    *repository.JobRepository
	limiter *rate.Limiter
	cohorts *CohortResolver
}

type ashbyResponse struct {
	Jobs []ashbyJob `json:"jobs"`
}

type ashbyJob struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	Department     string `json:"department"`
	Team           string `json:"team"`
	EmploymentType string `json:"employmentType"`
	Location       string `json:"location"`
	IsRemote       bool   `json:"isRemote"`
	PublishedAt    string `json:"publishedAt"`
	// IsListed goes false when a posting is unpublished but not yet deleted.
	IsListed         bool              `json:"isListed"`
	JobURL           string            `json:"jobUrl"`
	ApplyURL         string            `json:"applyUrl"`
	DescriptionPlain string            `json:"descriptionPlain"`
	Compensation     ashbyCompensation `json:"compensation"`
}

type ashbyCompensation struct {
	CompensationTierSummary string `json:"compensationTierSummary"`
}

func NewAshbyScraper(repo *repository.JobRepository) *AshbyScraper {
	return &AshbyScraper{
		client:  &http.Client{Timeout: 30 * time.Second},
		repo:    repo,
		limiter: rate.NewLimiter(rate.Every(time.Second), 5),
	}
}

func (s *AshbyScraper) ScrapeCompany(ctx context.Context, company, token string) error {
	log.Info().Str("company", company).Msg("Starting Ashby scrape")

	var board ashbyResponse
	err := RetryWithBackoff(ctx, 3, fmt.Sprintf("ashby:%s", token), func() error {
		if err := s.limiter.Wait(ctx); err != nil {
			return err
		}

		url := fmt.Sprintf("https://api.ashbyhq.com/posting-api/job-board/%s?includeCompensation=true", token)
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "JobDog/1.0")

		resp, err := s.client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("ashby board returned status %d", resp.StatusCode)
		}

		var decoded ashbyResponse
		if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
			return err
		}
		board = decoded
		return nil
	})
	if err != nil {
		return fmt.Errorf("ashby scrape for %s: %w", company, err)
	}

	imported := 0
	for _, posting := range board.Jobs {
		if !posting.IsListed {
			continue
		}

		job := &models.Job{
			Source:          "ashby",
			SourceJobID:     posting.ID,
			SourceURL:       firstNonEmpty(posting.ApplyURL, posting.JobURL),
			Title:           posting.Title,
			Company:         company,
			Location:        ashbyLocation(posting),
			EmploymentType:  ashbyEmploymentType(posting.EmploymentType, posting.Title),
			DescriptionText: posting.DescriptionPlain,
			Status:          "ACTIVE",
			PostedAt:        parseAshbyPublishedAt(posting.PublishedAt, posting.ID),
			SalaryRaw:       ashbySalary(posting),
		}
		job.ExperienceLevel = ClassifyExperienceLevel(job.Title, job.DescriptionText)

		jobID, descriptionAccepted, err := s.repo.UpsertJob(job)
		if err != nil {
			log.Error().Err(err).Str("company", company).Str("posting", posting.ID).
				Msg("Failed to upsert Ashby job")
			continue
		}
		imported++
		if !descriptionAccepted {
			continue
		}

		// Classify the graduation cohort. Deterministic first, model only for the
		// genuinely ambiguous, and never fatal to the scrape.
		s.cohorts.Resolve(ctx, jobID, job)

		required, preferred := ExtractSkills(job.DescriptionText)
		profile := &models.JobRequirementProfile{
			JobID:            jobID,
			RequiredSkills:   required,
			PreferredSkills:  preferred,
			ExtractionMethod: "KEYWORD",
		}
		if err := s.repo.UpsertJobRequirementProfile(profile); err != nil {
			log.Error().Err(err).Str("job_id", jobID).Msg("Failed to upsert Ashby requirement profile")
		}
	}

	log.Info().Str("company", company).Int("returned", len(board.Jobs)).Int("imported", imported).
		Msg("Completed Ashby scrape")
	return nil
}

// parseAshbyPublishedAt reads Ashby's RFC 3339 publish timestamp. As elsewhere, a
// value we cannot parse leaves the date unset rather than defaulting to a zero
// time, which would surface as a posting from year 1.
func parseAshbyPublishedAt(publishedAt, id string) *time.Time {
	if publishedAt == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, publishedAt)
	if err != nil {
		log.Warn().Err(err).Str("published_at", publishedAt).Str("posting", id).
			Msg("Could not parse Ashby publishedAt; leaving posted date unset")
		return nil
	}
	return &parsed
}

// ashbyEmploymentType maps Ashby's CamelCase enum onto ours. The title still wins
// for internships: some boards tag an internship "FullTime" because it is
// full-time hours for a fixed term.
func ashbyEmploymentType(employmentType, title string) string {
	if internPattern.MatchString(title) {
		return "INTERNSHIP"
	}
	switch strings.ToLower(strings.TrimSpace(employmentType)) {
	case "intern", "internship":
		return "INTERNSHIP"
	case "parttime":
		return "PART_TIME"
	case "contract", "temporary":
		return "CONTRACT"
	case "fulltime":
		return "FULL_TIME"
	default:
		return "FULL_TIME"
	}
}

func ashbyLocation(posting ashbyJob) string {
	location := strings.TrimSpace(posting.Location)
	if posting.IsRemote {
		if location == "" {
			return "Remote"
		}
		if !strings.Contains(strings.ToLower(location), "remote") {
			return location + " (Remote)"
		}
	}
	return location
}

// ashbySalary returns Ashby's rendered compensation summary, e.g.
// "$207K – $259K + Token Compensation". It is free-form text rather than a
// structured range, so it is stored raw for display and parsed downstream if a
// numeric range is ever needed.
func ashbySalary(posting ashbyJob) *string {
	summary := strings.TrimSpace(posting.Compensation.CompensationTierSummary)
	if summary == "" {
		return nil
	}
	return &summary
}

// SetCohortResolver attaches graduation-cohort classification. When unset the
// scraper still imports jobs, just without cohort data.
func (s *AshbyScraper) SetCohortResolver(r *CohortResolver) {
	s.cohorts = r
}
