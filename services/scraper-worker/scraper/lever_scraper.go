package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

type LeverScraper struct {
	client  *http.Client
	repo    *repository.JobRepository
	limiter *rate.Limiter
}

type LeverPosting struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	DescriptionPlain string `json:"descriptionPlain"`
	Additional       string `json:"additional"`
	HostedURL        string `json:"hostedUrl"`
	Categories       struct {
		Location   string `json:"location"`
		Commitment string `json:"commitment"`
	} `json:"categories"`
	CreatedAt   int64              `json:"createdAt"`
	SalaryRange *LeverSalaryRange  `json:"salaryRange"`
}

type LeverSalaryRange struct {
	Min      float64 `json:"min"`
	Max      float64 `json:"max"`
	Currency string  `json:"currency"`
	Interval string  `json:"interval"`
}

func NewLeverScraper(repo *repository.JobRepository) *LeverScraper {
	return &LeverScraper{
		client:  &http.Client{Timeout: 30 * time.Second},
		repo:    repo,
		limiter: rate.NewLimiter(rate.Every(time.Second), 3),
	}
}

func (s *LeverScraper) ScrapeCompany(ctx context.Context, company, slug string) error {
	log.Info().Str("company", company).Msg("Starting Lever scrape")

	var postings []LeverPosting

	err := RetryWithBackoff(ctx, 3, fmt.Sprintf("lever-scrape-%s", slug), func() error {
		if err := s.limiter.Wait(ctx); err != nil {
			return err
		}

		url := fmt.Sprintf("https://api.lever.co/v0/postings/%s", slug)

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

		if err := json.Unmarshal(body, &postings); err != nil {
			return fmt.Errorf("failed to parse JSON: %w", err)
		}

		return nil
	})

	if err != nil {
		return err
	}

	log.Info().Int("count", len(postings)).Str("company", company).Msg("Parsed Lever postings")

	for _, posting := range postings {
		commitmentIsIntern := strings.Contains(strings.ToLower(posting.Categories.Commitment), "intern")
		if !isInternship(posting.Text) && !commitmentIsIntern {
			continue
		}

		postedAt := time.UnixMilli(posting.CreatedAt)

		description := posting.DescriptionPlain
		if posting.Additional != "" {
			description += "\n\n" + stripHTML(posting.Additional)
		}

		var salaryRaw string
		if posting.SalaryRange != nil {
			salaryRaw = fmt.Sprintf("%s %.0f-%.0f/%s",
				posting.SalaryRange.Currency,
				posting.SalaryRange.Min,
				posting.SalaryRange.Max,
				posting.SalaryRange.Interval,
			)
			description += fmt.Sprintf("\n\nSalary: %s", salaryRaw)
		}

		job := models.Job{
			Source:          "lever",
			SourceJobID:     fmt.Sprintf("lever-%s-%s", slug, posting.ID),
			SourceURL:       posting.HostedURL,
			Title:           posting.Text,
			Company:         company,
			Location:        posting.Categories.Location,
			EmploymentType:  "INTERNSHIP",
			DescriptionText: description,
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

	log.Info().Str("company", company).Msg("Completed Lever scrape")
	return nil
}
