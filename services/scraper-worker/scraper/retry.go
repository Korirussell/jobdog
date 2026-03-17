package scraper

import (
	"context"
	"math"
	"time"

	"github.com/rs/zerolog/log"
)

func RetryWithBackoff(ctx context.Context, maxRetries int, operation string, fn func() error) error {
	var err error
	for attempt := 0; attempt < maxRetries; attempt++ {
		err = fn()
		if err == nil {
			return nil
		}

		if attempt < maxRetries-1 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			log.Warn().
				Err(err).
				Str("operation", operation).
				Int("attempt", attempt+1).
				Int("max_retries", maxRetries).
				Dur("backoff", backoff).
				Msg("Operation failed, retrying with backoff")

			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	log.Error().
		Err(err).
		Str("operation", operation).
		Int("max_retries", maxRetries).
		Msg("Operation failed after all retries")
	return err
}
