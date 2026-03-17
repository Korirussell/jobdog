package scraper

import (
	"context"
	"testing"
	"time"
)

func TestWorkdayAdapter_RateLimiting(t *testing.T) {
	adapter := NewWorkdayAdapter(nil)

	start := time.Now()
	for i := 0; i < 4; i++ {
		if err := adapter.limiter.Wait(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	duration := time.Since(start)

	// Should take at least 1 second for 4 requests at 3 req/sec
	if duration < time.Second {
		t.Errorf("Rate limiting not working: took %v, expected >= 1s", duration)
	}
}

func TestWorkdayAdapter_WorkerPoolSize(t *testing.T) {
	adapter := NewWorkdayAdapter(nil)

	if adapter.workerPool != 10 {
		t.Errorf("Expected worker pool size 10, got %d", adapter.workerPool)
	}
}
