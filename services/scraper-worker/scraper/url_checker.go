package scraper

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

// URLChecker verifies that a posting's apply link still leads to a live job.
//
// It only needs to cover postings whose source cannot vouch for them. A
// Greenhouse, Lever, Ashby or Workday posting is re-confirmed every cycle by
// the company's own listing API — if it disappears from there it stops being
// refreshed and the stale sweep closes it. A row from an aggregator list is
// just a link someone typed into a README, and that link outlives the job.
type URLChecker struct {
	client  *http.Client
	repo    *repository.JobRepository
	limiter *rate.Limiter
}

func NewURLChecker(repo *repository.JobRepository) *URLChecker {
	return &URLChecker{
		client:  &http.Client{Timeout: 20 * time.Second},
		repo:    repo,
		limiter: rate.NewLimiter(rate.Limit(5), 5),
	}
}

func (c *URLChecker) CheckAndPruneURLs(ctx context.Context) error {
	jobs, err := c.repo.GetActiveJobURLs()
	if err != nil {
		return fmt.Errorf("failed to fetch active job URLs: %w", err)
	}

	log.Info().Int("count", len(jobs)).Msg("Starting URL liveness check")

	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		pruned   int
		inconcl  int
		jobsChan = make(chan repository.ActiveJob, len(jobs))
	)

	for _, j := range jobs {
		jobsChan <- j
	}
	close(jobsChan)

	workers := 8
	if len(jobs) < workers {
		workers = len(jobs)
	}

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobsChan {
				if err := c.limiter.Wait(ctx); err != nil {
					return
				}

				verdict, reason := c.checkURL(ctx, job.SourceURL)
				switch verdict {
				case urlDead:
					if err := c.repo.MarkJobInactive(job.ID); err != nil {
						log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to mark job inactive")
						continue
					}
					log.Info().Str("job_id", job.ID).Str("url", job.SourceURL).Str("reason", reason).Msg("Closed dead job")
					mu.Lock()
					pruned++
					mu.Unlock()
				case urlUnknown:
					// Timeouts, bot-blocks (403/429) and server errors say nothing
					// about whether the job exists. Leave it for the next pass.
					mu.Lock()
					inconcl++
					mu.Unlock()
				}
			}
		}()
	}

	wg.Wait()

	log.Info().Int("total", len(jobs)).Int("closed", pruned).Int("inconclusive", inconcl).
		Msg("URL liveness check completed")
	return nil
}

type urlVerdict int

const (
	urlAlive urlVerdict = iota
	urlDead
	urlUnknown
)

// closedPhrases are what a careers page says in place of a removed job. They
// are matched against visible text only (scripts and styles stripped), since a
// single-page app's JavaScript bundle carries every one of its error strings
// whether or not the job in front of the reader exists.
var closedPhrases = []string{
	"this job is no longer available",
	"job is no longer available",
	"position is no longer available",
	"posting is no longer available",
	"this position has been filled",
	"position has been filled",
	"no longer accepting applications",
	"this job has expired",
	"job has expired",
	"this job has been closed",
	"job posting has been closed",
	"the job you requested was not found",
	"the job you are looking for is no longer open",
	"this requisition is no longer",
	"we couldn't find that job",
}

var (
	scriptStylePattern = regexp.MustCompile(`(?is)<(script|style|noscript)\b.*?</(script|style|noscript)>`)
	tagPattern         = regexp.MustCompile(`(?s)<[^>]*>`)
)

// maxCheckBody caps how much of a page is read. A removed-job message is near
// the top; the rest is not worth the bandwidth.
const maxCheckBody = 256 * 1024

func (c *URLChecker) checkURL(ctx context.Context, url string) (urlVerdict, string) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return urlUnknown, "bad request"
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	resp, err := c.client.Do(req)
	if err != nil {
		return urlUnknown, "request failed"
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusNotFound, resp.StatusCode == http.StatusGone:
		return urlDead, fmt.Sprintf("status %d", resp.StatusCode)
	case resp.StatusCode != http.StatusOK:
		return urlUnknown, fmt.Sprintf("status %d", resp.StatusCode)
	}

	// Greenhouse answers a removed job with a redirect to the company's board
	// root carrying ?error=true, a 200 that no status check can tell apart.
	if resp.Request != nil && resp.Request.URL != nil && strings.Contains(resp.Request.URL.RawQuery, "error=true") {
		return urlDead, "redirected to board with error=true"
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxCheckBody))
	if err != nil {
		return urlUnknown, "body read failed"
	}
	text := strings.ToLower(tagPattern.ReplaceAllString(scriptStylePattern.ReplaceAllString(string(body), " "), " "))
	for _, phrase := range closedPhrases {
		if strings.Contains(text, phrase) {
			return urlDead, "page says: " + phrase
		}
	}
	return urlAlive, ""
}
