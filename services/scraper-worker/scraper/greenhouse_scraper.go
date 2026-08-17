package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"
	"jobdog/scraper-worker/streaming"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

type GreenhouseScraper struct {
	client   *http.Client
	repo     *repository.JobRepository
	limiter  *rate.Limiter
	cohorts  *CohortResolver
	producer *streaming.Producer
}

// SetProducer switches this scraper onto the streaming path: instead of
// classifying and upserting synchronously, it publishes each raw posting to
// Kafka and lets the classifier consumer do the rest. Leave unset (the
// default) to keep the direct-upsert behavior this scraper always had.
func (s *GreenhouseScraper) SetProducer(p *streaming.Producer) {
	s.producer = p
}

type GreenhouseResponse struct {
	Jobs []struct {
		ID       int    `json:"id"`
		Title    string `json:"title"`
		Location struct {
			Name string `json:"name"`
		} `json:"location"`
		AbsoluteURL    string     `json:"absolute_url"`
		UpdatedAt      time.Time  `json:"updated_at"`
		FirstPublished *time.Time `json:"first_published"`
		Departments    []struct {
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

	var ghResp GreenhouseResponse

	err := RetryWithBackoff(ctx, 3, fmt.Sprintf("greenhouse:%s", company), func() error {
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

		if err := json.Unmarshal(body, &ghResp); err != nil {
			return fmt.Errorf("failed to parse JSON: %w", err)
		}

		return nil
	})

	if err != nil {
		return err
	}

	log.Info().Int("count", len(ghResp.Jobs)).Str("company", company).Msg("Parsed Greenhouse jobs")

	for _, ghJob := range ghResp.Jobs {
		// Filter for internships
		if !IsEarlyCareerRelevant(ghJob.Title) {
			continue
		}

		// Prefer first_published (the job's original posting date) over
		// updated_at (last-updated timestamp, which is misleading for
		// reposted/edited listings). Fall back to updated_at when
		// first_published is absent from the API response.
		postedAt := ghJob.UpdatedAt
		if ghJob.FirstPublished != nil {
			postedAt = *ghJob.FirstPublished
		}

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

		// Streaming path: hand the raw posting to Kafka and move on. The
		// classifier consumer does experience-level/grad-cohort/skills and the
		// actual upsert on its own schedule — that decoupling (see
		// docs/kafka.md) is the entire point, so this scraper's job stops here
		// rather than duplicating that work synchronously.
		if s.producer != nil {
			if err := s.producer.PublishRawPosting(ctx, job); err != nil {
				log.Error().Err(err).Str("company", company).Msg("Failed to publish raw posting")
			}
			continue
		}

		job.ExperienceLevel = ClassifyExperienceLevel(job.Title, job.DescriptionText)

		jobID, descriptionAccepted, err := s.repo.UpsertJob(&job)
		if err != nil {
			log.Error().Err(err).Str("company", company).Msg("Failed to upsert job")
			continue
		}
		if !descriptionAccepted {
			continue
		}

		// Classify the graduation cohort. Deterministic first, model only for the
		// genuinely ambiguous, and never fatal to the scrape.
		s.cohorts.Resolve(ctx, jobID, &job)

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

// stripHTML strips markup from an ATS-provided content field down to plain
// text. Decoding entities before stripping tags matters: some ATS content
// (SpaceX's Greenhouse postings, at least) is doubly-escaped — the whole
// field is a literal "&lt;div&gt;...&lt;/div&gt;" string rather than real
// tags — which the tag-stripping regex can't see, since there's no literal
// '<' to match. Left undecoded, that garbage leaks straight through to the
// stored description and onto the job detail page verbatim.
func stripHTML(rawHTML string) string {
	decoded := html.UnescapeString(rawHTML)
	re := regexp.MustCompile(`<[^>]*>`)
	text := re.ReplaceAllString(decoded, " ")
	// Clean up multiple spaces
	text = strings.Join(strings.Fields(text), " ")
	return strings.TrimSpace(text)
}

// SetCohortResolver attaches graduation-cohort classification. When unset the
// scraper still imports jobs, just without cohort data.
func (s *GreenhouseScraper) SetCohortResolver(r *CohortResolver) {
	s.cohorts = r
}
