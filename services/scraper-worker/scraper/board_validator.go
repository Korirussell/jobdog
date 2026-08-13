package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// BoardValidation is the outcome of probing a discovered board.
type BoardValidation struct {
	Board    Board
	JobCount int
	Err      error
}

// Valid reports whether the board is worth adding to the scrape config. A board
// that answers but has no postings is treated as invalid: the most common cause
// is a wrong identifier, and those fail *softly* — Workday in particular returns
// HTTP 200 with zero results for a bad site name, which would otherwise ship a
// permanently empty source that looks healthy in logs forever.
func (v BoardValidation) Valid() bool {
	return v.Err == nil && v.JobCount > 0
}

// BoardValidator probes discovered boards against their live ATS API.
type BoardValidator struct {
	client  *http.Client
	limiter *rate.Limiter
	workers int
}

func NewBoardValidator() *BoardValidator {
	return &BoardValidator{
		client: &http.Client{Timeout: 25 * time.Second},
		// Deliberately gentle: this runs against other companies' infrastructure,
		// and being rate-limited or blocked would cost us the whole source.
		limiter: rate.NewLimiter(rate.Every(100*time.Millisecond), 5),
		workers: 8,
	}
}

// ValidateAll probes every board concurrently and returns results in the same
// order as the input.
func (v *BoardValidator) ValidateAll(ctx context.Context, boards []Board) []BoardValidation {
	results := make([]BoardValidation, len(boards))

	indexes := make(chan int)
	var wg sync.WaitGroup

	for i := 0; i < v.workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range indexes {
				count, err := v.Validate(ctx, boards[idx])
				results[idx] = BoardValidation{Board: boards[idx], JobCount: count, Err: err}
			}
		}()
	}

	for i := range boards {
		indexes <- i
	}
	close(indexes)
	wg.Wait()

	return results
}

// Validate probes one board and returns how many postings it exposes.
func (v *BoardValidator) Validate(ctx context.Context, board Board) (int, error) {
	if err := v.limiter.Wait(ctx); err != nil {
		return 0, err
	}

	switch board.Platform {
	case PlatformGreenhouse:
		return v.countJSONArray(ctx, "GET",
			fmt.Sprintf("https://boards-api.greenhouse.io/v1/boards/%s/jobs", board.Token), nil, "jobs")
	case PlatformLever:
		return v.countTopLevelArray(ctx,
			fmt.Sprintf("https://api.lever.co/v0/postings/%s?mode=json", board.Token))
	case PlatformAshby:
		return v.countJSONArray(ctx, "GET",
			fmt.Sprintf("https://api.ashbyhq.com/posting-api/job-board/%s", board.Token), nil, "jobs")
	case PlatformWorkday:
		body := []byte(`{"appliedFacets":{},"limit":1,"offset":0,"searchText":""}`)
		return v.countWorkday(ctx, WorkdayBaseURL(board.Tenant, board.Datacenter, board.Site)+"/jobs", body)
	default:
		return 0, fmt.Errorf("unsupported platform %q", board.Platform)
	}
}

func (v *BoardValidator) countJSONArray(ctx context.Context, method, url string, body []byte, field string) (int, error) {
	raw, err := v.fetch(ctx, method, url, body)
	if err != nil {
		return 0, err
	}
	var decoded map[string]json.RawMessage
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return 0, fmt.Errorf("decoding response: %w", err)
	}
	var items []json.RawMessage
	if err := json.Unmarshal(decoded[field], &items); err != nil {
		return 0, fmt.Errorf("decoding %q: %w", field, err)
	}
	return len(items), nil
}

func (v *BoardValidator) countTopLevelArray(ctx context.Context, url string) (int, error) {
	raw, err := v.fetch(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, fmt.Errorf("decoding response: %w", err)
	}
	return len(items), nil
}

func (v *BoardValidator) countWorkday(ctx context.Context, url string, body []byte) (int, error) {
	raw, err := v.fetch(ctx, "POST", url, body)
	if err != nil {
		return 0, err
	}
	var decoded struct {
		Total int `json:"total"`
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return 0, fmt.Errorf("decoding response: %w", err)
	}
	return decoded.Total, nil
}

func (v *BoardValidator) fetch(ctx context.Context, method, url string, body []byte) ([]byte, error) {
	var reader *bytes.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	} else {
		reader = bytes.NewReader(nil)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("User-Agent", workdayUserAgent)

	resp, err := v.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
