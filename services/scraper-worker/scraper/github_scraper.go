package scraper

import (
	"context"
	"crypto/sha256"
	"fmt"
	"html"
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

type GitHubScraper struct {
	client  *http.Client
	repo    *repository.JobRepository
	limiter *rate.Limiter
}

func NewGitHubScraper(repo *repository.JobRepository) *GitHubScraper {
	return &GitHubScraper{
		client:  &http.Client{Timeout: 30 * time.Second},
		repo:    repo,
		limiter: rate.NewLimiter(rate.Every(time.Second), 5), // 5 requests per second
	}
}

func (s *GitHubScraper) ScrapeSimplifyRepo(ctx context.Context) error {
	log.Info().Msg("Starting Simplify repo scrape")

	content, err := s.fetchSimplifyReadme(ctx)
	if err != nil {
		return err
	}

	jobs := s.parseMarkdownTable(content)

	log.Info().Int("count", len(jobs)).Msg("Parsed jobs from Simplify repo")

	for _, job := range jobs {
		jobID, err := s.repo.UpsertJob(&job)
		if err != nil {
			log.Error().Err(err).Str("company", job.Company).Msg("Failed to upsert job")
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

	log.Info().Msg("Completed Simplify repo scrape")
	return nil
}

func (s *GitHubScraper) fetchSimplifyReadme(ctx context.Context) (string, error) {
	urls := []string{
		"https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/master/README.md",
		"https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md",
	}

	for _, url := range urls {
		// Rate limit
		if err := s.limiter.Wait(ctx); err != nil {
			return "", err
		}

		request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return "", fmt.Errorf("failed to create simplify README request: %w", err)
		}

		response, err := s.client.Do(request)
		if err != nil {
			continue
		}

		body, readErr := io.ReadAll(response.Body)
		response.Body.Close()
		if readErr != nil {
			continue
		}

		if response.StatusCode != http.StatusOK {
			continue
		}

		return string(body), nil
	}

	return "", fmt.Errorf("failed to fetch simplify README from known branches")
}

func (s *GitHubScraper) parseMarkdownTable(content string) []models.Job {
	if strings.Contains(content, "<table>") {
		return s.parseHTMLTable(content)
	}

	var jobs []models.Job

	lines := strings.Split(content, "\n")

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

		company := strings.TrimSpace(parts[1])
		role := strings.TrimSpace(parts[2])
		location := strings.TrimSpace(parts[3])
		linkPart := strings.TrimSpace(parts[4])

		matches := urlRegex.FindStringSubmatch(linkPart)

		if len(matches) < 2 {
			continue
		}

		url := matches[1]

		if company == "" || role == "" || url == "" {
			continue
		}

		job := models.Job{
			Source:          "github-simplify",
			SourceJobID:     simplifySourceJobID(url),
			SourceURL:       url,
			Title:           role,
			Company:         company,
			Location:        location,
			EmploymentType:  "INTERNSHIP",
			DescriptionText: fmt.Sprintf("%s at %s - %s", role, company, location),
			Status:          "ACTIVE",
			PostedAt:        nil, // Set to nil until we can parse real dates
		}

		jobs = append(jobs, job)
	}

	return jobs
}

func (s *GitHubScraper) parseHTMLTable(content string) []models.Job {
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
		applyURL := extractApplyURL(cells[3][1])

		if company == "↳" || company == "" {
			company = lastCompany
		} else {
			lastCompany = company
		}

		if company == "" || role == "" || applyURL == "" {
			continue
		}

		job := models.Job{
			Source:          "github-simplify",
			SourceJobID:     simplifySourceJobID(applyURL),
			SourceURL:       applyURL,
			Title:           role,
			Company:         company,
			Location:        location,
			EmploymentType:  "INTERNSHIP",
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
