package scraper

import (
	"context"
	"crypto/sha256"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

type GitHubScraper struct {
	client  *http.Client
	repo    *repository.JobRepository
	limiter *rate.Limiter
	cohorts *CohortResolver
}

func NewGitHubScraper(repo *repository.JobRepository) *GitHubScraper {
	return &GitHubScraper{
		client:  &http.Client{Timeout: 30 * time.Second},
		repo:    repo,
		limiter: rate.NewLimiter(rate.Every(time.Second), 5), // 5 requests per second
	}
}

// ScrapeRepo ingests one aggregator README. employmentType applies to every row,
// since each aggregator repo covers a single kind of role.
func (s *GitHubScraper) ScrapeRepo(ctx context.Context, repo, employmentType string) error {
	log.Info().Str("repo", repo).Msg("Starting aggregator repo scrape")

	content, err := s.fetchReadme(ctx, repo)
	if err != nil {
		return err
	}

	jobs := s.parseMarkdownTable(content, employmentType, sourceTagForRepo(repo))

	log.Info().Str("repo", repo).Int("count", len(jobs)).Msg("Parsed jobs from aggregator repo")

	for _, job := range jobs {
		job.ExperienceLevel = ClassifyExperienceLevel(job.Title, job.DescriptionText)
		jobID, err := s.repo.UpsertJob(&job)
		if err != nil {
			log.Error().Err(err).Str("company", job.Company).Msg("Failed to upsert job")
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

	log.Info().Str("repo", repo).Msg("Completed aggregator repo scrape")
	return nil
}

// fetchReadme tries each branch a repo might publish on. Aggregators vary in
// which branch holds the live table — some update dev and merge to master
// periodically, so dev is tried first to get the freshest listings.
func (s *GitHubScraper) fetchReadme(ctx context.Context, repo string) (string, error) {
	branches := []string{"dev", "master", "main"}
	urls := make([]string, 0, len(branches))
	for _, branch := range branches {
		urls = append(urls, fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/README.md", repo, branch))
	}

	for _, url := range urls {
		var body string

		err := RetryWithBackoff(ctx, 3, "github:simplify-readme", func() error {
			// Rate limit
			if err := s.limiter.Wait(ctx); err != nil {
				return err
			}

			request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			if err != nil {
				return fmt.Errorf("failed to create simplify README request: %w", err)
			}

			response, err := s.client.Do(request)
			if err != nil {
				return err
			}

			bodyBytes, readErr := io.ReadAll(response.Body)
			response.Body.Close()
			if readErr != nil {
				return readErr
			}

			if response.StatusCode != http.StatusOK {
				return fmt.Errorf("unexpected status code: %d", response.StatusCode)
			}

			body = string(bodyBytes)
			return nil
		})

		if err == nil {
			return body, nil
		}
	}

	return "", fmt.Errorf("failed to fetch README for %s from branches %v", repo, []string{"dev", "master", "main"})
}

// sourceTagForRepo derives a short, stable Source tag ("github-simplify",
// "github-vanshb03") from an aggregator's "owner/repo" string, so jobs stay
// traceable to which aggregator found them without needing a schema change.
func sourceTagForRepo(repo string) string {
	owner := repo
	if idx := strings.Index(repo, "/"); idx >= 0 {
		owner = repo[:idx]
	}
	return "github-" + strings.ToLower(owner)
}

func (s *GitHubScraper) parseMarkdownTable(content, employmentType, sourceTag string) []models.Job {
	// Match the opening tag by prefix, not exactly: these READMEs are rendered by
	// tooling that emits attributes ("<table style=...>"), and requiring the bare
	// tag silently routes an HTML table into the markdown parser, which finds no
	// pipe-delimited rows and returns nothing.
	if strings.Contains(content, "<table") {
		return s.parseHTMLTable(content, employmentType, sourceTag)
	}

	var jobs []models.Job

	lines := strings.Split(content, "\n")

	// Some aggregators (SimplifyJobs) write a plain markdown link in the
	// Application column; others (vansh/Ouckah's repos) wrap an <img> badge in
	// an HTML anchor instead. Try the markdown form first, then fall back to
	// extractApplyURL's href scan — same fallback parseHTMLTable already uses.
	urlRegex := regexp.MustCompile(`\[.*?\]\((https?://[^\)]+)\)`)

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if !strings.HasPrefix(line, "|") {
			continue
		}

		if strings.Contains(line, "Company") || strings.Contains(line, "---") {
			continue
		}

		parts := strings.Split(line, "|")
		if len(parts) < 5 {
			continue
		}

		company := stripMarkdownEmphasis(strings.TrimSpace(parts[1]))
		role := stripMarkdownEmphasis(strings.TrimSpace(parts[2]))
		location := cleanHTMLText(strings.TrimSpace(parts[3]))
		linkPart := strings.TrimSpace(parts[4])

		var applyURL string
		if matches := urlRegex.FindStringSubmatch(linkPart); len(matches) >= 2 {
			applyURL = matches[1]
		} else {
			applyURL = extractApplyURL(linkPart)
		}
		applyURL = canonicalizeApplyURL(applyURL)

		if company == "" || role == "" || applyURL == "" {
			continue
		}

		job := models.Job{
			Source:          sourceTag,
			SourceJobID:     simplifySourceJobID(applyURL),
			SourceURL:       applyURL,
			Title:           role,
			Company:         company,
			Location:        location,
			EmploymentType:  employmentType,
			DescriptionText: fmt.Sprintf("%s at %s - %s", role, company, location),
			Status:          "ACTIVE",
			PostedAt:        nil, // Set to nil until we can parse real dates
		}

		jobs = append(jobs, job)
	}

	return jobs
}

// stripMarkdownEmphasis removes bold/italic wrapping ("**Quora**" -> "Quora")
// that some aggregators apply to the company or role column.
func stripMarkdownEmphasis(value string) string {
	value = strings.TrimSpace(value)
	for _, marker := range []string{"***", "**", "*", "__", "_"} {
		if strings.HasPrefix(value, marker) && strings.HasSuffix(value, marker) && len(value) > 2*len(marker) {
			value = strings.TrimSpace(value[len(marker) : len(value)-len(marker)])
		}
	}
	return value
}

// canonicalizeApplyURL strips query string and fragment from an ATS apply
// link. Every aggregator appends its own tracking params (utm_source, ref,
// jr_id, ...) to what is otherwise the identical underlying posting URL, so
// hashing/storing the raw link means the same job scraped from two aggregators
// gets stored twice — ON CONFLICT (source_url) never fires because the two
// tracking-tagged URLs differ. The job identity lives in the path for every
// ATS we support (Greenhouse, Lever, Ashby, Workday), never the query string,
// so dropping it is safe and makes cross-aggregator dedup actually work.
func canonicalizeApplyURL(rawURL string) string {
	if rawURL == "" {
		return ""
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String()
}

func (s *GitHubScraper) parseHTMLTable(content, employmentType, sourceTag string) []models.Job {
	var jobs []models.Job

	rowRegex := regexp.MustCompile(`(?is)<tr>(.*?)</tr>`)
	cellRegex := regexp.MustCompile(`(?is)<td[^>]*>(.*?)</td>`)

	rows := rowRegex.FindAllStringSubmatch(content, -1)
	lastCompany := ""

	for _, row := range rows {
		cells := cellRegex.FindAllStringSubmatch(row[1], -1)
		if len(cells) < 4 {
			continue
		}

		company := cleanHTMLText(cells[0][1])
		role := cleanHTMLText(cells[1][1])
		location := cleanHTMLText(cells[2][1])
		applyURL := canonicalizeApplyURL(extractApplyURL(cells[3][1]))

		if company == "↳" || company == "" {
			company = lastCompany
		} else {
			lastCompany = company
		}

		if company == "" || role == "" || applyURL == "" {
			continue
		}

		job := models.Job{
			Source:          sourceTag,
			SourceJobID:     simplifySourceJobID(applyURL),
			SourceURL:       applyURL,
			Title:           role,
			Company:         company,
			Location:        location,
			EmploymentType:  employmentType,
			DescriptionText: fmt.Sprintf("%s at %s - %s", role, company, location),
			Status:          "ACTIVE",
			PostedAt:        nil, // Set to nil until we can parse real dates
		}

		jobs = append(jobs, job)
	}

	return jobs
}

func extractApplyURL(cell string) string {
	urlRegex := regexp.MustCompile(`href="(https?://[^"]+)"`)
	matches := urlRegex.FindAllStringSubmatch(cell, -1)
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		url := html.UnescapeString(match[1])
		if strings.Contains(url, "simplify.jobs/p/") || strings.Contains(url, "simplify.jobs/c/") {
			continue
		}
		return url
	}
	return ""
}

func cleanHTMLText(value string) string {
	lineBreakRegex := regexp.MustCompile(`(?i)<br\s*/?>`)
	tagRegex := regexp.MustCompile(`(?s)<[^>]+>`)
	value = lineBreakRegex.ReplaceAllString(value, ", ")
	value = tagRegex.ReplaceAllString(value, "")
	value = html.UnescapeString(value)
	value = strings.ReplaceAll(value, "🔥", "")
	value = strings.TrimSpace(value)
	value = strings.Join(strings.Fields(value), " ")
	return value
}

func simplifySourceJobID(sourceURL string) string {
	hash := sha256.Sum256([]byte(sourceURL))
	return fmt.Sprintf("%x", hash)
}

func timePtr(t time.Time) *time.Time {
	return &t
}

// ParseAggregatorReadme exposes the aggregator table parser for tooling that
// needs the parsed rows without persisting them — notably the discovery command,
// which reads the ATS links out of each row to build the board registry.
func ParseAggregatorReadme(content, employmentType, repo string) []models.Job {
	s := &GitHubScraper{}
	return s.parseMarkdownTable(content, employmentType, sourceTagForRepo(repo))
}

// SetCohortResolver attaches graduation-cohort classification. When unset the
// scraper still imports jobs, just without cohort data.
func (s *GitHubScraper) SetCohortResolver(r *CohortResolver) {
	s.cohorts = r
}
