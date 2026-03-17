package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

type WorkdayAdapter struct {
	client     *http.Client
	repo       *repository.JobRepository
	limiter    *rate.Limiter
	workerPool int
}

type WorkdaySearchRequest struct {
	AppliedFacets map[string][]string `json:"appliedFacets"`
	Limit         int                 `json:"limit"`
	Offset        int                 `json:"offset"`
	SearchText    string              `json:"searchText"`
}

type WorkdaySearchResponse struct {
	Total       int                   `json:"total"`
	JobPostings []WorkdayJobListing   `json:"jobPostings"`
	Facets      map[string][]WorkdayFacet `json:"facetSearchResult,omitempty"`
}

type WorkdayJobListing struct {
	Title      string `json:"title"`
	BulletinID string `json:"bulletinID"`
	PostedOn   string `json:"postedOn"`
	Location   string `json:"locationsText"`
}

type WorkdayFacet struct {
	Title string `json:"title"`
	Count int    `json:"count"`
}

type WorkdayJobDetail struct {
	JobReqID    string `json:"jobReqId"`
	Title       string `json:"title"`
	Description string `json:"jobDescription"`
	PostedDate  string `json:"postedOn"`
	Location    string `json:"location"`
}

func NewWorkdayAdapter(repo *repository.JobRepository) *WorkdayAdapter {
	return &WorkdayAdapter{
		client:     &http.Client{Timeout: 30 * time.Second},
		repo:       repo,
		limiter:    rate.NewLimiter(rate.Every(time.Second), 3),
		workerPool: 10,
	}
}

func (w *WorkdayAdapter) ScrapeCompany(ctx context.Context, company, tenant, jobSite string) error {
	log.Info().Str("company", company).Msg("Starting Workday scrape")
	
	baseURL := fmt.Sprintf("https://%s.wd1.myworkdayjobs.com/wday/cxs/%s/%s", tenant, tenant, jobSite)
	
	initialReq := WorkdaySearchRequest{
		AppliedFacets: map[string][]string{},
		Limit:         20,
		Offset:        0,
		SearchText:    "",
	}
	
	initialResp, err := w.fetchJobList(ctx, baseURL, initialReq)
	if err != nil {
		return fmt.Errorf("initial fetch failed: %w", err)
	}
	
	if initialResp.Total > 2000 {
		log.Warn().Int("total", initialResp.Total).Msg("Total exceeds 2,000 - using facet splitting")
		return w.scrapeWithFacetSplitting(ctx, company, baseURL, initialResp)
	}
	
	return w.scrapeWithPagination(ctx, company, baseURL, initialResp.Total)
}

func (w *WorkdayAdapter) scrapeWithPagination(ctx context.Context, company, baseURL string, total int) error {
	const pageSize = 20
	var allJobs []WorkdayJobListing
	
	for offset := 0; offset < total; offset += pageSize {
		if err := w.limiter.Wait(ctx); err != nil {
			return err
		}
		
		req := WorkdaySearchRequest{
			AppliedFacets: map[string][]string{},
			Limit:         pageSize,
			Offset:        offset,
			SearchText:    "",
		}
		
		resp, err := w.fetchJobList(ctx, baseURL, req)
		if err != nil {
			log.Error().Err(err).Int("offset", offset).Msg("Failed to fetch page")
			continue
		}
		
		allJobs = append(allJobs, resp.JobPostings...)
		log.Info().Int("fetched", len(resp.JobPostings)).Int("total", total).Msg("Fetched page")
	}
	
	return w.fetchDetailsAndUpsert(ctx, company, baseURL, allJobs)
}

func (w *WorkdayAdapter) scrapeWithFacetSplitting(ctx context.Context, company, baseURL string, initialResp *WorkdaySearchResponse) error {
	locationFacets := initialResp.Facets["locations"]
	
	if len(locationFacets) == 0 {
		log.Warn().Msg("No location facets available - falling back to pagination with 2,000 limit")
		return w.scrapeWithPagination(ctx, company, baseURL, 2000)
	}
	
	var allJobs []WorkdayJobListing
	
	for _, facet := range locationFacets {
		log.Info().Str("location", facet.Title).Int("count", facet.Count).Msg("Scraping facet")
		
		if facet.Count > 2000 {
			log.Warn().Str("location", facet.Title).Msg("Facet still exceeds 2,000 - skipping")
			continue
		}
		
		for offset := 0; offset < facet.Count; offset += 20 {
			if err := w.limiter.Wait(ctx); err != nil {
				return err
			}
			
			req := WorkdaySearchRequest{
				AppliedFacets: map[string][]string{
					"locations": {facet.Title},
				},
				Limit:      20,
				Offset:     offset,
				SearchText: "",
			}
			
			resp, err := w.fetchJobList(ctx, baseURL, req)
			if err != nil {
				log.Error().Err(err).Str("facet", facet.Title).Msg("Failed to fetch facet page")
				continue
			}
			
			allJobs = append(allJobs, resp.JobPostings...)
		}
	}
	
	return w.fetchDetailsAndUpsert(ctx, company, baseURL, allJobs)
}

func (w *WorkdayAdapter) fetchJobList(ctx context.Context, baseURL string, req WorkdaySearchRequest) (*WorkdaySearchResponse, error) {
	url := baseURL + "/jobs"
	
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	
	resp, err := w.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}
	
	var result WorkdaySearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	return &result, nil
}

func (w *WorkdayAdapter) fetchDetailsAndUpsert(ctx context.Context, company, baseURL string, jobs []WorkdayJobListing) error {
	jobChan := make(chan WorkdayJobListing, len(jobs))
	errChan := make(chan error, len(jobs))
	
	var wg sync.WaitGroup
	for i := 0; i < w.workerPool; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobChan {
				if err := w.fetchDetailAndUpsert(ctx, company, baseURL, job); err != nil {
					errChan <- err
				}
			}
		}()
	}
	
	for _, job := range jobs {
		jobChan <- job
	}
	close(jobChan)
	
	wg.Wait()
	close(errChan)
	
	errorCount := 0
	for err := range errChan {
		log.Error().Err(err).Msg("Worker error")
		errorCount++
	}
	
	log.Info().Int("total", len(jobs)).Int("errors", errorCount).Msg("Completed detail fetching")
	return nil
}

func (w *WorkdayAdapter) fetchDetailAndUpsert(ctx context.Context, company, baseURL string, listing WorkdayJobListing) error {
	if err := w.limiter.Wait(ctx); err != nil {
		return err
	}
	
	detailURL := fmt.Sprintf("%s/job/%s", baseURL, listing.BulletinID)
	
	httpReq, err := http.NewRequestWithContext(ctx, "GET", detailURL, nil)
	if err != nil {
		return err
	}
	
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	
	resp, err := w.client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("detail fetch failed: %d", resp.StatusCode)
	}
	
	var detail WorkdayJobDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		return err
	}
	
	postedAt, _ := time.Parse("2006-01-02", detail.PostedDate)
	
	job := &models.Job{
		Source:          "workday",
		SourceJobID:     detail.JobReqID,
		SourceURL:       detailURL,
		Title:           detail.Title,
		Company:         company,
		Location:        detail.Location,
		EmploymentType:  "FULL_TIME",
		DescriptionText: detail.Description,
		Status:          "ACTIVE",
		PostedAt:        &postedAt,
	}
	
	jobID, err := w.repo.UpsertJob(job)
	if err != nil {
		return fmt.Errorf("failed to upsert job: %w", err)
	}
	
	required, preferred := ExtractSkills(job.DescriptionText)
	profile := &models.JobRequirementProfile{
		JobID:            jobID,
		RequiredSkills:   required,
		PreferredSkills:  preferred,
		ExtractionMethod: "KEYWORD",
	}
	
	if err := w.repo.UpsertJobRequirementProfile(profile); err != nil {
		log.Error().Err(err).Str("job_id", jobID).Msg("Failed to upsert requirement profile")
	}
	
	return nil
}
