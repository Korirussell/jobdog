package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

// WorkdayScraper reads Workday's public "CxS" candidate-experience API, the same
// JSON endpoints the hosted careers site calls from the browser.
//
// Two endpoints are involved:
//
//	POST {base}/jobs           — paginated job list, 20 per page
//	GET  {base}/job/{path}     — full posting, including the description
//
// where {base} is https://{tenant}.{datacenter}.myworkdayjobs.com/wday/cxs/{tenant}/{site}.
type WorkdayScraper struct {
	client     *http.Client
	repo       *repository.JobRepository
	limiter    *rate.Limiter
	workerPool int
}

// workdaySearchRequest is the POST body for the job-list endpoint.
type workdaySearchRequest struct {
	AppliedFacets map[string][]string `json:"appliedFacets"`
	Limit         int                 `json:"limit"`
	Offset        int                 `json:"offset"`
	SearchText    string              `json:"searchText"`
}

type workdaySearchResponse struct {
	Total       int                 `json:"total"`
	JobPostings []workdayJobListing `json:"jobPostings"`
	Facets      []workdayFacet      `json:"facets"`
}

// workdayJobListing is one entry in the list response. Note there is no job ID
// here — ExternalPath is what addresses the detail endpoint, and the requisition
// ID arrives inside BulletFields.
type workdayJobListing struct {
	Title         string   `json:"title"`
	ExternalPath  string   `json:"externalPath"`
	LocationsText string   `json:"locationsText"`
	PostedOn      string   `json:"postedOn"`
	BulletFields  []string `json:"bulletFields"`
}

type workdayFacet struct {
	FacetParameter string              `json:"facetParameter"`
	Descriptor     string              `json:"descriptor"`
	Values         []workdayFacetValue `json:"values"`
}

type workdayFacetValue struct {
	Descriptor string `json:"descriptor"`
	ID         string `json:"id"`
	Count      int    `json:"count"`
}

// workdayDetailResponse wraps everything one level deep under jobPostingInfo.
type workdayDetailResponse struct {
	JobPostingInfo workdayJobDetail `json:"jobPostingInfo"`
}

type workdayJobDetail struct {
	JobReqID    string `json:"jobReqId"`
	Title       string `json:"title"`
	Description string `json:"jobDescription"`
	Location    string `json:"location"`
	// StartDate is the posting's own date in YYYY-MM-DD form. PostedOn next to it
	// is a rendered relative string ("Posted Yesterday") and is never parseable —
	// StartDate is the only honest posted date Workday exposes.
	StartDate   string `json:"startDate"`
	PostedOn    string `json:"postedOn"`
	TimeType    string `json:"timeType"`
	ExternalURL string `json:"externalUrl"`
}

// workdayPageSize is fixed by the API — larger values are silently clamped.
const workdayPageSize = 20

// workdayResultCap is Workday's hard ceiling on how deep offset pagination will
// go for a single query. Past it the API stops returning new rows, so tenants
// with more postings than this have to be split across facets.
const workdayResultCap = 2000

func NewWorkdayScraper(repo *repository.JobRepository) *WorkdayScraper {
	return &WorkdayScraper{
		client:     &http.Client{Timeout: 30 * time.Second},
		repo:       repo,
		limiter:    rate.NewLimiter(rate.Every(time.Second), 3),
		workerPool: 10,
	}
}

// WorkdayBaseURL builds the CxS API root for a tenant. The datacenter segment
// varies per customer (wd1, wd3, wd5, wd12, …) and is not derivable from the
// tenant name, so it comes from configuration.
func WorkdayBaseURL(tenant, datacenter, site string) string {
	return fmt.Sprintf("https://%s.%s.myworkdayjobs.com/wday/cxs/%s/%s", tenant, datacenter, tenant, site)
}

func (w *WorkdayScraper) ScrapeCompany(ctx context.Context, company, tenant, datacenter, site string) error {
	log.Info().Str("company", company).Str("tenant", tenant).Msg("Starting Workday scrape")

	baseURL := WorkdayBaseURL(tenant, datacenter, site)

	initial, err := w.fetchJobList(ctx, baseURL, workdaySearchRequest{
		AppliedFacets: map[string][]string{},
		Limit:         workdayPageSize,
		Offset:        0,
	})
	if err != nil {
		return fmt.Errorf("workday initial fetch for %s: %w", company, err)
	}

	log.Info().Str("company", company).Int("total", initial.Total).Msg("Workday job count")

	var listings []workdayJobListing
	if initial.Total > workdayResultCap {
		listings = w.collectByFacet(ctx, company, baseURL, initial)
	} else {
		listings = w.collectByPagination(ctx, baseURL, map[string][]string{}, initial.Total)
	}

	return w.fetchDetailsAndUpsert(ctx, company, baseURL, listings)
}

// collectByPagination walks offsets for a single query, stopping at the API's
// result cap.
func (w *WorkdayScraper) collectByPagination(ctx context.Context, baseURL string, facets map[string][]string, total int) []workdayJobListing {
	if total > workdayResultCap {
		total = workdayResultCap
	}

	var listings []workdayJobListing
	for offset := 0; offset < total; offset += workdayPageSize {
		resp, err := w.fetchJobList(ctx, baseURL, workdaySearchRequest{
			AppliedFacets: facets,
			Limit:         workdayPageSize,
			Offset:        offset,
		})
		if err != nil {
			log.Error().Err(err).Int("offset", offset).Msg("Workday page fetch failed, skipping page")
			continue
		}
		if len(resp.JobPostings) == 0 {
			break
		}
		listings = append(listings, resp.JobPostings...)
	}
	return listings
}

// collectByFacet splits a too-large tenant into per-facet queries so each stays
// under the result cap. It picks the facet whose largest bucket is smallest,
// since that is the one most likely to bring every bucket under the ceiling.
func (w *WorkdayScraper) collectByFacet(ctx context.Context, company, baseURL string, initial *workdaySearchResponse) []workdayJobListing {
	best, ok := bestSplittingFacet(initial.Facets)
	if !ok {
		log.Warn().Str("company", company).Int("total", initial.Total).
			Msg("Workday tenant exceeds result cap but exposes no usable facet; capping at 2000")
		return w.collectByPagination(ctx, baseURL, map[string][]string{}, workdayResultCap)
	}

	log.Info().Str("company", company).Str("facet", best.FacetParameter).
		Int("buckets", len(best.Values)).Msg("Splitting Workday tenant by facet")

	seen := map[string]struct{}{}
	var listings []workdayJobListing

	for _, value := range best.Values {
		if value.Count > workdayResultCap {
			log.Warn().Str("company", company).Str("bucket", value.Descriptor).Int("count", value.Count).
				Msg("Workday facet bucket still exceeds result cap; it will be truncated")
		}
		page := w.collectByPagination(ctx, baseURL, map[string][]string{
			best.FacetParameter: {value.ID},
		}, value.Count)

		// Buckets can overlap (a posting listed in two locations), so dedupe on the
		// detail path rather than trusting the counts to sum.
		for _, listing := range page {
			if _, dup := seen[listing.ExternalPath]; dup {
				continue
			}
			seen[listing.ExternalPath] = struct{}{}
			listings = append(listings, listing)
		}
	}

	return listings
}

// bestSplittingFacet returns the facet whose largest bucket is smallest — the
// split most likely to bring every bucket under the result cap.
func bestSplittingFacet(facets []workdayFacet) (workdayFacet, bool) {
	var best workdayFacet
	bestMax := 0
	found := false

	for _, facet := range facets {
		if len(facet.Values) < 2 {
			continue
		}
		max := 0
		for _, value := range facet.Values {
			if value.Count > max {
				max = value.Count
			}
		}
		if !found || max < bestMax {
			best, bestMax, found = facet, max, true
		}
	}
	return best, found
}

func (w *WorkdayScraper) fetchJobList(ctx context.Context, baseURL string, req workdaySearchRequest) (*workdaySearchResponse, error) {
	if req.AppliedFacets == nil {
		req.AppliedFacets = map[string][]string{}
	}

	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	var result workdaySearchResponse
	err = RetryWithBackoff(ctx, 3, "workday:jobs", func() error {
		if err := w.limiter.Wait(ctx); err != nil {
			return err
		}

		httpReq, err := http.NewRequestWithContext(ctx, "POST", baseURL+"/jobs", bytes.NewReader(payload))
		if err != nil {
			return err
		}
		httpReq.Header.Set("Accept", "application/json")
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("User-Agent", workdayUserAgent)

		resp, err := w.client.Do(httpReq)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("workday job list returned status %d", resp.StatusCode)
		}

		var decoded workdaySearchResponse
		if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
			return err
		}
		result = decoded
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// workdayUserAgent — Workday's CDN rejects requests without a browser-shaped
// user agent, so the honest "JobDog/1.0" string gets 403s here.
const workdayUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

func (w *WorkdayScraper) fetchDetailsAndUpsert(ctx context.Context, company, baseURL string, listings []workdayJobListing) error {
	if len(listings) == 0 {
		log.Info().Str("company", company).Msg("No Workday postings found")
		return nil
	}

	workers := w.workerPool
	if len(listings) < workers {
		workers = len(listings)
	}

	jobChan := make(chan workdayJobListing)
	var wg sync.WaitGroup
	var mu sync.Mutex
	failed := 0

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for listing := range jobChan {
				if err := w.fetchDetailAndUpsert(ctx, company, baseURL, listing); err != nil {
					log.Error().Err(err).Str("path", listing.ExternalPath).Msg("Workday detail fetch failed")
					mu.Lock()
					failed++
					mu.Unlock()
				}
			}
		}()
	}

	for _, listing := range listings {
		jobChan <- listing
	}
	close(jobChan)
	wg.Wait()

	log.Info().Str("company", company).Int("total", len(listings)).Int("failed", failed).
		Msg("Completed Workday scrape")

	// A handful of individually broken postings is normal and shouldn't fail the
	// whole company; a wholesale failure means something structural changed.
	if failed == len(listings) {
		return fmt.Errorf("workday: all %d detail fetches failed for %s", failed, company)
	}
	return nil
}

func (w *WorkdayScraper) fetchDetailAndUpsert(ctx context.Context, company, baseURL string, listing workdayJobListing) error {
	var detail workdayJobDetail

	err := RetryWithBackoff(ctx, 3, "workday:detail", func() error {
		if err := w.limiter.Wait(ctx); err != nil {
			return err
		}

		httpReq, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/job"+listing.ExternalPath, nil)
		if err != nil {
			return err
		}
		httpReq.Header.Set("Accept", "application/json")
		httpReq.Header.Set("User-Agent", workdayUserAgent)

		resp, err := w.client.Do(httpReq)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("workday job detail returned status %d", resp.StatusCode)
		}

		var decoded workdayDetailResponse
		if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
			return err
		}
		detail = decoded.JobPostingInfo
		return nil
	})
	if err != nil {
		return err
	}

	job := &models.Job{
		Source:          "workday",
		SourceJobID:     workdaySourceJobID(detail, listing),
		SourceURL:       workdayApplyURL(detail, listing),
		Title:           firstNonEmpty(detail.Title, listing.Title),
		Company:         company,
		Location:        firstNonEmpty(detail.Location, listing.LocationsText),
		EmploymentType:  workdayEmploymentType(detail.TimeType, detail.Title),
		DescriptionText: stripHTML(detail.Description),
		Status:          "ACTIVE",
		PostedAt:        parseWorkdayPostedAt(detail.StartDate, listing.ExternalPath),
	}
	job.ExperienceLevel = ClassifyExperienceLevel(job.Title, job.DescriptionText)

	jobID, err := w.repo.UpsertJob(job)
	if err != nil {
		return fmt.Errorf("upserting workday job: %w", err)
	}

	required, preferred := ExtractSkills(job.DescriptionText)
	profile := &models.JobRequirementProfile{
		JobID:            jobID,
		RequiredSkills:   required,
		PreferredSkills:  preferred,
		ExtractionMethod: "KEYWORD",
	}
	if err := w.repo.UpsertJobRequirementProfile(profile); err != nil {
		log.Error().Err(err).Str("job_id", jobID).Msg("Failed to upsert Workday requirement profile")
	}

	return nil
}

// parseWorkdayPostedAt reads the posting date from startDate. Workday's postedOn
// field is a rendered relative string ("Posted Yesterday", "Posted 30+ Days Ago")
// and never parses, so it is deliberately not used as a fallback — an unset date
// is honest, a zero-value date is not.
func parseWorkdayPostedAt(startDate, path string) *time.Time {
	if startDate == "" {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		log.Warn().Err(err).Str("start_date", startDate).Str("path", path).
			Msg("Could not parse Workday startDate; leaving posted date unset")
		return nil
	}
	return &parsed
}

// workdaySourceJobID prefers the requisition ID, which is stable across
// re-postings and title edits. bulletFields carries the same value in the list
// response, so it serves as a fallback when the detail payload is thin.
func workdaySourceJobID(detail workdayJobDetail, listing workdayJobListing) string {
	if detail.JobReqID != "" {
		return detail.JobReqID
	}
	if len(listing.BulletFields) > 0 && listing.BulletFields[0] != "" {
		return listing.BulletFields[0]
	}
	return listing.ExternalPath
}

// workdayApplyURL returns the human-facing careers URL. The CxS endpoint we
// fetched is a JSON API — sending a user there would show them a raw payload.
func workdayApplyURL(detail workdayJobDetail, listing workdayJobListing) string {
	if detail.ExternalURL != "" {
		return detail.ExternalURL
	}
	return listing.ExternalPath
}

func workdayEmploymentType(timeType, title string) string {
	if internPattern.MatchString(title) {
		return "INTERNSHIP"
	}
	switch strings.ToLower(strings.TrimSpace(timeType)) {
	case "part time":
		return "PART_TIME"
	case "full time":
		return "FULL_TIME"
	default:
		return "FULL_TIME"
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
