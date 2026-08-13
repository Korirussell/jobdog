package scraper

import (
	"encoding/json"
	"os"
	"testing"
)

func TestWorkdayBaseURL(t *testing.T) {
	got := WorkdayBaseURL("amat", "wd1", "External")
	want := "https://amat.wd1.myworkdayjobs.com/wday/cxs/amat/External"
	if got != want {
		t.Errorf("WorkdayBaseURL() = %q, want %q", got, want)
	}
}

func TestParseWorkdayPostedAt(t *testing.T) {
	t.Run("parses an ISO start date", func(t *testing.T) {
		got := parseWorkdayPostedAt("2026-08-12", "/job/x")
		if got == nil {
			t.Fatal("expected a parsed date, got nil")
		}
		if got.Format("2006-01-02") != "2026-08-12" {
			t.Errorf("got %s, want 2026-08-12", got.Format("2006-01-02"))
		}
	})

	t.Run("missing start date leaves the posted date unset", func(t *testing.T) {
		if got := parseWorkdayPostedAt("", "/job/x"); got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	// Workday's postedOn field looks like this. If it were ever used as a
	// fallback it would fail to parse and yield a zero-value time, which reads
	// as "posted in year 1" downstream — nil is the honest answer.
	t.Run("a relative date string yields nil, not a zero time", func(t *testing.T) {
		if got := parseWorkdayPostedAt("Posted Yesterday", "/job/x"); got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})
}

func TestWorkdaySourceJobID(t *testing.T) {
	cases := []struct {
		name    string
		detail  workdayJobDetail
		listing workdayJobListing
		want    string
	}{
		{
			name:   "prefers the requisition id",
			detail: workdayJobDetail{JobReqID: "R2623639"},
			listing: workdayJobListing{
				BulletFields: []string{"R9999999"},
				ExternalPath: "/job/Hsinchu/Some-Role_R2623639",
			},
			want: "R2623639",
		},
		{
			name:   "falls back to bulletFields when detail is thin",
			detail: workdayJobDetail{},
			listing: workdayJobListing{
				BulletFields: []string{"R2623639"},
				ExternalPath: "/job/Hsinchu/Some-Role_R2623639",
			},
			want: "R2623639",
		},
		{
			name:    "falls back to the external path as a last resort",
			detail:  workdayJobDetail{},
			listing: workdayJobListing{ExternalPath: "/job/Hsinchu/Some-Role_R2623639"},
			want:    "/job/Hsinchu/Some-Role_R2623639",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := workdaySourceJobID(tc.detail, tc.listing); got != tc.want {
				t.Errorf("workdaySourceJobID() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestWorkdayApplyURL(t *testing.T) {
	// The URL we fetched is a JSON API endpoint — sending a candidate there would
	// show them a raw payload, so externalUrl must win.
	detail := workdayJobDetail{ExternalURL: "https://amat.wd1.myworkdayjobs.com/External/job/Hsinchu/Role_R1"}
	listing := workdayJobListing{ExternalPath: "/job/Hsinchu/Role_R1"}

	if got := workdayApplyURL(detail, listing); got != detail.ExternalURL {
		t.Errorf("workdayApplyURL() = %q, want the human-facing URL %q", got, detail.ExternalURL)
	}
	if got := workdayApplyURL(workdayJobDetail{}, listing); got != listing.ExternalPath {
		t.Errorf("fallback = %q, want %q", got, listing.ExternalPath)
	}
}

func TestWorkdayEmploymentType(t *testing.T) {
	cases := []struct {
		timeType string
		title    string
		want     string
	}{
		{"Full time", "Software Engineer", "FULL_TIME"},
		{"Part time", "Software Engineer", "PART_TIME"},
		{"", "Software Engineer", "FULL_TIME"},
		// An intern title beats Workday's own "Full time" classification, which
		// most tenants set on internships too.
		{"Full time", "Software Engineer Intern", "INTERNSHIP"},
	}

	for _, tc := range cases {
		if got := workdayEmploymentType(tc.timeType, tc.title); got != tc.want {
			t.Errorf("workdayEmploymentType(%q, %q) = %q, want %q", tc.timeType, tc.title, got, tc.want)
		}
	}
}

func TestBestSplittingFacet(t *testing.T) {
	facets := []workdayFacet{
		{
			FacetParameter: "Country",
			Values: []workdayFacetValue{
				{Descriptor: "USA", ID: "us", Count: 1800},
				{Descriptor: "India", ID: "in", Count: 900},
			},
		},
		{
			FacetParameter: "jobFamilyGroup",
			Values: []workdayFacetValue{
				{Descriptor: "Engineering", ID: "eng", Count: 600},
				{Descriptor: "Sales", ID: "sales", Count: 400},
				{Descriptor: "Ops", ID: "ops", Count: 300},
			},
		},
		// Single-value facets can't split anything.
		{FacetParameter: "remoteType", Values: []workdayFacetValue{{Descriptor: "Onsite", ID: "on", Count: 2700}}},
	}

	got, ok := bestSplittingFacet(facets)
	if !ok {
		t.Fatal("expected a usable facet")
	}
	// jobFamilyGroup's largest bucket is 600 vs Country's 1800, so it is the split
	// most likely to bring every bucket under the 2000 result cap.
	if got.FacetParameter != "jobFamilyGroup" {
		t.Errorf("chose %q, want jobFamilyGroup (smallest maximum bucket)", got.FacetParameter)
	}

	t.Run("no splittable facet", func(t *testing.T) {
		_, ok := bestSplittingFacet([]workdayFacet{
			{FacetParameter: "remoteType", Values: []workdayFacetValue{{ID: "on", Count: 2700}}},
		})
		if ok {
			t.Error("expected no usable facet when every facet has fewer than two values")
		}
	})
}

// TestWorkdayDecodesLiveAPIShape guards against the failure that made the
// previous Workday implementation dead on arrival: its structs named fields
// ("bulletinID", a flat detail object) that the API does not return, so every
// job silently decoded to empty values. These fixtures are trimmed captures of
// real responses — if Workday changes the shape, this test fails loudly instead
// of the scraper quietly importing blank rows.
func TestWorkdayDecodesLiveAPIShape(t *testing.T) {
	t.Run("job list", func(t *testing.T) {
		raw, err := os.ReadFile("testdata/workday_list.json")
		if err != nil {
			t.Fatal(err)
		}
		var resp workdaySearchResponse
		if err := json.Unmarshal(raw, &resp); err != nil {
			t.Fatalf("decoding job list: %v", err)
		}
		if resp.Total == 0 {
			t.Error("Total did not decode")
		}
		if len(resp.JobPostings) == 0 {
			t.Fatal("JobPostings did not decode")
		}
		listing := resp.JobPostings[0]
		if listing.Title == "" {
			t.Error("Title did not decode")
		}
		if listing.ExternalPath == "" {
			t.Error("ExternalPath did not decode — this is what addresses the detail endpoint")
		}
		if len(listing.BulletFields) == 0 {
			t.Error("BulletFields did not decode — this carries the requisition id")
		}
		if len(resp.Facets) == 0 || len(resp.Facets[0].Values) == 0 {
			t.Error("Facets did not decode — needed to split tenants over the result cap")
		}
	})

	t.Run("job detail", func(t *testing.T) {
		raw, err := os.ReadFile("testdata/workday_detail.json")
		if err != nil {
			t.Fatal(err)
		}
		var resp workdayDetailResponse
		if err := json.Unmarshal(raw, &resp); err != nil {
			t.Fatalf("decoding job detail: %v", err)
		}
		detail := resp.JobPostingInfo
		for name, value := range map[string]string{
			"JobReqID":    detail.JobReqID,
			"Title":       detail.Title,
			"Description": detail.Description,
			"StartDate":   detail.StartDate,
			"ExternalURL": detail.ExternalURL,
			"TimeType":    detail.TimeType,
		} {
			if value == "" {
				t.Errorf("%s did not decode from the nested jobPostingInfo object", name)
			}
		}
		if parseWorkdayPostedAt(detail.StartDate, "") == nil {
			t.Error("startDate from a real response should parse into a posted date")
		}
	})
}
