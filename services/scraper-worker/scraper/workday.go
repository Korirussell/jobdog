package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"
	"jobdog/scraper-worker/streaming"

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
	cohorts    *CohortResolver
	producer   *streaming.Producer
}

// SetProducer switches this scraper onto the streaming path — see
// GreenhouseScraper.SetProducer for the full rationale. Leave unset (the
// default) to keep classifying and upserting synchronously.
func (s *WorkdayScraper) SetProducer(p *streaming.Producer) {
	s.producer = p
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
		limiter:    rate.NewLimiter(rate.Every(500*time.Millisecond), 4),
		workerPool: 4,
	}
}

// WorkdayBaseURL builds the CxS API root for a tenant. The datacenter segment
// varies per customer (wd1, wd3, wd5, wd12, …) and is not derivable from the
// tenant name, so it comes from configuration.
func WorkdayBaseURL(tenant, datacenter, site string) string {
	return fmt.Sprintf("https://%s.%s.myworkdayjobs.com/wday/cxs/%s/%s", tenant, datacenter, tenant, site)
}

// workdayCampusSitePattern picks out the Workday sites a company has already
// scoped to early-career hiring ("Campus_Careers", "University_Talent",
// "Futureforce_NewGradRoles", "INTERN"). Those are small and are crawled in
// full; every other site is the company's whole board.
var workdayCampusSitePattern = regexp.MustCompile(`(?i)campus|univ|student|new[-_ ]?grad|ncg|intern|futureforce|early[-_ ]?career|talent`)

// workdayEarlyCareerQueries are the searches run against a company's whole
// board. Workday ranks results by relevance, so each of these puts the roles
// that actually say "new grad" / "intern" / "entry level" at the top — which
// is the only part of a 2,000-posting board this site wants.
var workdayEarlyCareerQueries = []string{
	"new college grad",
	"new grad",
	"university graduate",
	"early career",
	"entry level",
	"associate software engineer",
	"software engineer I",
	"junior software engineer",
	"intern",
}

const (
	// workdayQueryResultCap bounds how deep one search is followed.
	workdayQueryResultCap = 200
	// workdayMaxNewDetailFetches bounds the new postings fetched in full per
	// board per cycle. Anything beyond it is picked up on the next cycle, once
	// this one's accepted and rejected postings have been recorded and skipped.
	workdayMaxNewDetailFetches = 80
)

// workdayBoard is everything needed to scrape and address one Workday site.
type workdayBoard struct {
	company    string
	tenant     string
	datacenter string
	site       string
	baseURL    string
	trust      SourceTrust
}

// publicURL is the human-facing careers URL of a posting, built from the same
// host the posting was fetched from. The old code used whatever the payload's
// externalUrl said, and fell back to the bare relative path when it was
// empty — a link to nowhere — while some tenants' externalUrl points at a
// retired custom domain that now answers 410.
func (b workdayBoard) publicURL(externalPath string) string {
	return fmt.Sprintf("https://%s.%s.myworkdayjobs.com/%s%s", b.tenant, b.datacenter, b.site, externalPath)
}

// sourceJobID is unique per posting (and per location variant of one
// requisition), and known from the list response alone — which is what lets
// an already-stored posting be skipped without a detail fetch.
func (b workdayBoard) sourceJobID(externalPath string) string {
	return b.tenant + ":" + externalPath
}

func (w *WorkdayScraper) ScrapeCompany(ctx context.Context, company, tenant, datacenter, site string) error {
	log.Info().Str("company", company).Str("tenant", tenant).Msg("Starting Workday scrape")

	board := workdayBoard{
		company:    company,
		tenant:     tenant,
		datacenter: datacenter,
		site:       site,
		baseURL:    WorkdayBaseURL(tenant, datacenter, site),
		trust:      TrustNone,
	}
	if workdayCampusSitePattern.MatchString(site) {
		board.trust = TrustCurated
	}

	var listings []workdayJobListing
	if board.trust == TrustNone {
		listings = w.searchEarlyCareer(ctx, board)
		log.Info().Str("company", company).Int("matched", len(listings)).Msg("Workday early-career search results")
	} else {
		initial, err := w.fetchJobList(ctx, board.baseURL, workdaySearchRequest{
			AppliedFacets: map[string][]string{},
			Limit:         workdayPageSize,
			Offset:        0,
		})
		if err != nil {
			return fmt.Errorf("workday initial fetch for %s: %w", company, err)
		}
		log.Info().Str("company", company).Int("total", initial.Total).Msg("Workday job count")

		if initial.Total > workdayResultCap {
			listings = w.collectByFacet(ctx, company, board.baseURL, initial)
		} else {
			listings = w.collectByPagination(ctx, board.baseURL, map[string][]string{}, initial.Total)
		}
	}

	return w.fetchDetailsAndUpsert(ctx, board, listings)
}

// searchEarlyCareer runs the early-career searches against a whole-company
// board and returns the union of their results.
func (w *WorkdayScraper) searchEarlyCareer(ctx context.Context, board workdayBoard) []workdayJobListing {
	seen := map[string]struct{}{}
	var out []workdayJobListing

	for _, query := range workdayEarlyCareerQueries {
		for offset := 0; offset < workdayQueryResultCap; offset += workdayPageSize {
			resp, err := w.fetchJobList(ctx, board.baseURL, workdaySearchRequest{
				AppliedFacets: map[string][]string{},
				Limit:         workdayPageSize,
				Offset:        offset,
				SearchText:    query,
			})
			if err != nil {
				log.Warn().Err(err).Str("company", board.company).Str("query", query).
					Msg("Workday search failed, moving to the next query")
				break
			}
			if len(resp.JobPostings) == 0 {
				break
			}

			withSignal := 0
			for _, listing := range resp.JobPostings {
				if TitleHasEarlyCareerSignal(listing.Title) {
					withSignal++
				}
				if _, dup := seen[listing.ExternalPath]; dup {
					continue
				}
				seen[listing.ExternalPath] = struct{}{}
				out = append(out, listing)
			}

			// Results come back relevance-ranked. Once a whole page has nothing
			// that announces itself as early-career, the rest of this query's
			// tail is the fuzzy-match noise ("new" or "grad" appearing somewhere
			// in a senior posting's text) and is not worth following.
			if withSignal == 0 || offset+workdayPageSize >= resp.Total {
				break
			}
		}
	}
	return out
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

func (w *WorkdayScraper) fetchDetailsAndUpsert(ctx context.Context, board workdayBoard, listings []workdayJobListing) error {
	company := board.company
	if len(listings) == 0 {
		log.Info().Str("company", company).Msg("No Workday postings found")
		return nil
	}

	// 1. Title-only rejection, before anything is fetched.
	candidates := make([]workdayJobListing, 0, len(listings))
	for _, listing := range listings {
		if !IsEarlyCareerRelevant(listing.Title) {
			continue
		}
		if !IsTechTitle(listing.Title) {
			continue
		}
		candidates = append(candidates, listing)
	}

	// 2. Incremental: a posting already stored is just marked as still listed,
	// and one rejected recently is not looked at again. Without this every
	// cycle re-fetched (one HTTP request each) everything it had already
	// decided about — hours of work per cycle for a handful of new postings.
	ids := make([]string, len(candidates))
	for i, listing := range candidates {
		ids[i] = board.sourceJobID(listing.ExternalPath)
	}
	known, err := w.repo.ActiveSourceJobIDs("workday", ids)
	if err != nil {
		log.Warn().Err(err).Str("company", company).Msg("Could not look up stored Workday postings; fetching all")
		known = map[string]bool{}
	}
	rejected, err := w.repo.RecentlyRejected("workday", ids, rejectionMemory)
	if err != nil {
		log.Warn().Err(err).Str("company", company).Msg("Could not look up rejected Workday postings; fetching all")
		rejected = map[string]bool{}
	}

	var stillListed []string
	var fresh []workdayJobListing
	for i, listing := range candidates {
		switch {
		case known[ids[i]]:
			stillListed = append(stillListed, ids[i])
		case rejected[ids[i]]:
		default:
			fresh = append(fresh, listing)
		}
	}
	if len(stillListed) > 0 {
		if err := w.repo.TouchSourceJobs("workday", stillListed); err != nil {
			log.Error().Err(err).Str("company", company).Msg("Failed to refresh stored Workday postings")
		}
	}

	// 3. Bounded: titles that announce themselves as early-career first, and a
	// cap on how many new postings one cycle fetches in full.
	sort.SliceStable(fresh, func(i, j int) bool {
		return TitleHasEarlyCareerSignal(fresh[i].Title) && !TitleHasEarlyCareerSignal(fresh[j].Title)
	})
	deferred := 0
	if board.trust == TrustNone && len(fresh) > workdayMaxNewDetailFetches {
		deferred = len(fresh) - workdayMaxNewDetailFetches
		fresh = fresh[:workdayMaxNewDetailFetches]
	}

	if len(fresh) == 0 {
		log.Info().Str("company", company).Int("listed", len(listings)).Int("already_stored", len(stillListed)).
			Msg("Completed Workday scrape (nothing new)")
		return nil
	}

	workers := w.workerPool
	if len(fresh) < workers {
		workers = len(fresh)
	}

	jobChan := make(chan workdayJobListing)
	var wg sync.WaitGroup
	var mu sync.Mutex
	failed, accepted := 0, 0
	var rejectedIDs []string

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for listing := range jobChan {
				ok, err := w.fetchDetailAndUpsert(ctx, board, listing)
				mu.Lock()
				switch {
				case err != nil:
					failed++
					log.Error().Err(err).Str("path", listing.ExternalPath).Msg("Workday detail fetch failed")
				case ok:
					accepted++
				default:
					rejectedIDs = append(rejectedIDs, board.sourceJobID(listing.ExternalPath))
				}
				mu.Unlock()
			}
		}()
	}

	for _, listing := range fresh {
		jobChan <- listing
	}
	close(jobChan)
	wg.Wait()

	if len(rejectedIDs) > 0 {
		if err := w.repo.RecordRejections("workday", rejectedIDs, "not early-career"); err != nil {
			log.Error().Err(err).Str("company", company).Msg("Failed to record rejected Workday postings")
		}
	}

	log.Info().Str("company", company).Int("listed", len(listings)).Int("already_stored", len(stillListed)).
		Int("fetched", len(fresh)).Int("accepted", accepted).Int("rejected", len(rejectedIDs)).
		Int("failed", failed).Int("deferred", deferred).Msg("Completed Workday scrape")

	// A handful of individually broken postings is normal and shouldn't fail the
	// whole company; a wholesale failure means something structural changed.
	if failed == len(fresh) {
		return fmt.Errorf("workday: all %d detail fetches failed for %s", failed, company)
	}
	return nil
}

// jobFromDetail builds the stored form of a posting from its list entry and
// its full detail.
func jobFromDetail(board workdayBoard, listing workdayJobListing, detail workdayJobDetail) *models.Job {
	return &models.Job{
		Source:          "workday",
		SourceJobID:     board.sourceJobID(listing.ExternalPath),
		SourceURL:       board.publicURL(listing.ExternalPath),
		Title:           firstNonEmpty(detail.Title, listing.Title),
		Company:         board.company,
		Location:        firstNonEmpty(detail.Location, listing.LocationsText),
		EmploymentType:  workdayEmploymentType(detail.TimeType, detail.Title),
		DescriptionText: stripHTML(detail.Description),
		Status:          "ACTIVE",
		PostedAt:        parseWorkdayPostedAt(detail.StartDate, listing.ExternalPath),
	}
}

// rejectionMemory is how long a rejected posting is skipped before it is
// looked at again — long enough to stop re-fetching the same thousand
// postings every cycle, short enough that an edited posting gets a second look.
const rejectionMemory = 14 * 24 * time.Hour

// fetchDetailAndUpsert fetches one posting in full and stores it if it passes
// the ingest gate. accepted is false (with a nil error) when the posting was
// fetched fine and simply isn't an early-career role.
func (w *WorkdayScraper) fetchDetailAndUpsert(ctx context.Context, board workdayBoard, listing workdayJobListing) (accepted bool, err error) {
	company := board.company
	var detail workdayJobDetail

	err = RetryWithBackoff(ctx, 3, "workday:detail", func() error {
		if err := w.limiter.Wait(ctx); err != nil {
			return err
		}

		httpReq, err := http.NewRequestWithContext(ctx, "GET", workdayDetailURL(board.baseURL, listing.ExternalPath), nil)
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
		return false, err
	}

	job := jobFromDetail(board, listing, detail)

	if ok, _ := AcceptListing(job, board.trust); !ok {
		return false, nil
	}

	if w.producer != nil {
		if err := w.producer.PublishRawPosting(ctx, *job); err != nil {
			log.Error().Err(err).Str("company", company).Msg("Failed to publish raw posting")
		}
		return true, nil
	}

	job.ExperienceLevel = ClassifyExperienceLevel(job.Title, job.DescriptionText)
	job.RoleCategory = string(ClassifyRoleCategory(job.Title))
	job.LocationScope = string(ClassifyLocationScope(job.Location))

	jobID, descriptionAccepted, err := w.repo.UpsertJob(job)
	if err != nil {
		return false, fmt.Errorf("upserting workday job: %w", err)
	}
	if !descriptionAccepted {
		return true, nil
	}

	// Classify the graduation cohort. Deterministic first, model only for the
	// genuinely ambiguous, and never fatal to the scrape.
	w.cohorts.Resolve(ctx, jobID, job)

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

	return true, nil
}

// workdayDetailURL joins the CxS base to a listing's detail path.
//
// externalPath already begins with "/job/", so the base must not add its own —
// concatenating one produces "/job/job/..." which Workday answers with 406, and
// since every detail fetch fails identically the scraper imports nothing while
// the job-list call keeps succeeding.
func workdayDetailURL(baseURL, externalPath string) string {
	return baseURL + externalPath
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

// SetCohortResolver attaches graduation-cohort classification. When unset the
// scraper still imports jobs, just without cohort data.
func (s *WorkdayScraper) SetCohortResolver(r *CohortResolver) {
	s.cohorts = r
}
