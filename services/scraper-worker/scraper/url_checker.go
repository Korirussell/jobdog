package scraper

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

type URLChecker struct {
	client  *http.Client
	repo    *repository.JobRepository
	limiter *rate.Limiter
}

func NewURLChecker(repo *repository.JobRepository) *URLChecker {
	return &URLChecker{
		client:  &http.Client{Timeout: 15 * time.Second},
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
		wg         sync.WaitGroup
		mu         sync.Mutex
		pruned     int
		errors     int
		jobsChan   = make(chan repository.ActiveJob, len(jobs))
	)

	for _, j := range jobs {
		jobsChan <- j
	}
	close(jobsChan)

	workers := 10
	if len(jobs) < workers {
		workers = len(jobs)
	}

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for job := range jobsChan {
				if err := c.limiter.Wait(ctx); err != nil {
					log.Warn().Err(err).Msg("Rate limiter cancelled")
					return
				}

				dead, err := c.checkURL(ctx, job.SourceURL)
				if err != nil {
					log.Warn().Err(err).Str("url", job.SourceURL).Msg("URL check failed")
					mu.Lock()
					errors++
					mu.Unlock()
					continue
				}

				if dead {
					if err := c.repo.MarkJobInactive(job.ID); err != nil {
						log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to mark job inactive")
						mu.Lock()
						errors++
						mu.Unlock()
						continue
					}
					log.Info().Str("job_id", job.ID).Str("url", job.SourceURL).Msg("Marked dead job as inactive")
					mu.Lock()
					pruned++
					mu.Unlock()
				}
			}
		}(i)
	}

	wg.Wait()

	log.Info().
		Int("total", len(jobs)).
		Int("pruned", pruned).
		Int("errors", errors).
		Msg("URL liveness check completed")

	return nil
}

func (c *URLChecker) checkURL(ctx context.Context, url string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := c.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone, nil
}
