//go:build live

package scraper

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"
)

// TestLiveWorkdayHarvest runs the real early-career search against a live
// Workday board and shows what the ingest gate decides about each result. It
// is how to check a board before (or after) adding it to sources.json:
//
//	WD_TENANT=nvidia WD_DC=wd5 WD_SITE=NVIDIAExternalCareerSite \
//	  go test -tags live -run TestLiveWorkdayHarvest -v ./scraper/
//
// It needs network access and no database, and is excluded from normal test
// runs by the build tag.
func TestLiveWorkdayHarvest(t *testing.T) {
	tenant, dc, site := os.Getenv("WD_TENANT"), os.Getenv("WD_DC"), os.Getenv("WD_SITE")
	if tenant == "" || dc == "" || site == "" {
		t.Skip("set WD_TENANT, WD_DC and WD_SITE")
	}

	w := NewWorkdayScraper(nil)
	board := workdayBoard{
		company: tenant, tenant: tenant, datacenter: dc, site: site,
		baseURL: WorkdayBaseURL(tenant, dc, site), trust: TrustNone,
	}
	if workdayCampusSitePattern.MatchString(site) {
		board.trust = TrustCurated
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	listings := w.searchEarlyCareer(ctx, board)
	t.Logf("search returned %d unique postings", len(listings))

	var candidates []workdayJobListing
	for _, l := range listings {
		if IsEarlyCareerRelevant(l.Title) && (board.trust == TrustCurated || IsTechTitle(l.Title)) {
			candidates = append(candidates, l)
		}
	}
	t.Logf("%d pass the title gates (not senior, technical)", len(candidates))

	limit := 40
	if len(candidates) < limit {
		limit = len(candidates)
	}
	accepted := 0
	for _, l := range candidates[:limit] {
		resp, err := http.Get(workdayDetailURL(board.baseURL, l.ExternalPath))
		if err != nil {
			continue
		}
		var decoded workdayDetailResponse
		_ = json.NewDecoder(resp.Body).Decode(&decoded)
		resp.Body.Close()
		d := decoded.JobPostingInfo

		job := jobFromDetail(board, l, d)
		ok, reason := AcceptListing(job, board.trust)
		if ok {
			accepted++
		}
		verdict := "KEEP"
		if !ok {
			verdict = "drop (" + reason + ")"
		}
		t.Logf("%-40s | %-28s | %s", truncate(job.Title, 40), verdict, board.publicURL(l.ExternalPath))
		time.Sleep(600 * time.Millisecond)
	}
	t.Logf("kept %d of the first %d candidates fetched in full", accepted, limit)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}
