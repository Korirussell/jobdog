package scraper

import (
	"testing"

	"jobdog/scraper-worker/models"
)

func TestClassifyATSURL(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want Board
		ok   bool
	}{
		{
			name: "greenhouse current host",
			url:  "https://job-boards.greenhouse.io/andurilindustries/jobs/4520123",
			want: Board{Platform: PlatformGreenhouse, Token: "andurilindustries"},
			ok:   true,
		},
		{
			name: "greenhouse legacy host",
			url:  "https://boards.greenhouse.io/stripe",
			want: Board{Platform: PlatformGreenhouse, Token: "stripe"},
			ok:   true,
		},
		{
			name: "greenhouse embed carries the token in a query param",
			url:  "https://boards.greenhouse.io/embed/job_board?for=discord&token=123",
			want: Board{Platform: PlatformGreenhouse, Token: "discord"},
			ok:   true,
		},
		{
			name: "lever",
			url:  "https://jobs.lever.co/plaid/8f3c1a20-1111-2222-3333-444455556666",
			want: Board{Platform: PlatformLever, Token: "plaid"},
			ok:   true,
		},
		{
			name: "ashby with tracking params",
			url:  "https://jobs.ashbyhq.com/uniswap/fb4d4137-f003-4669/application?embed=true&utm_source=Simplify",
			want: Board{Platform: PlatformAshby, Token: "uniswap"},
			ok:   true,
		},
		{
			name: "workday",
			url:  "https://amat.wd1.myworkdayjobs.com/External/job/GloucesterMA/XMLNAME-2027-SWE_R2625762",
			want: Board{Platform: PlatformWorkday, Tenant: "amat", Datacenter: "wd1", Site: "External"},
			ok:   true,
		},
		{
			name: "workday with a locale segment before the site",
			url:  "https://avav.wd1.myworkdayjobs.com/en-US/AeroVironment/job/Simi-Valley/Engineer_R1234",
			want: Board{Platform: PlatformWorkday, Tenant: "avav", Datacenter: "wd1", Site: "AeroVironment"},
			ok:   true,
		},
		{
			name: "workday datacenters other than wd1",
			url:  "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job/x",
			want: Board{Platform: PlatformWorkday, Tenant: "salesforce", Datacenter: "wd12", Site: "External_Career_Site"},
			ok:   true,
		},
		// Bespoke company career sites are out of scope by design — each would
		// need its own parser, which is the maintenance burden we're avoiding.
		{name: "bespoke career site", url: "https://about.nextdoor.com/careers/xyz", ok: false},
		{name: "aggregator redirect", url: "https://simplify.jobs/p/85a7cdca-c4d0", ok: false},
		{name: "empty", url: "", ok: false},
		{name: "not a url", url: "not a url at all", ok: false},
		// A Workday host with no site segment can't be polled.
		{name: "workday root only", url: "https://amat.wd1.myworkdayjobs.com/", ok: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := ClassifyATSURL(tc.url)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v (got board %+v)", ok, tc.ok, got)
			}
			if !tc.ok {
				return
			}
			if got.Platform != tc.want.Platform || got.Token != tc.want.Token ||
				got.Tenant != tc.want.Tenant || got.Datacenter != tc.want.Datacenter || got.Site != tc.want.Site {
				t.Errorf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestDiscoverBoards(t *testing.T) {
	jobs := []models.Job{
		{Company: "Anduril", SourceURL: "https://job-boards.greenhouse.io/andurilindustries/jobs/1"},
		// Same board, different posting — must collapse to one entry.
		{Company: "Anduril", SourceURL: "https://job-boards.greenhouse.io/andurilindustries/jobs/2"},
		{Company: "Plaid", SourceURL: "https://jobs.lever.co/plaid/abc"},
		{Company: "Applied Materials", SourceURL: "https://amat.wd1.myworkdayjobs.com/External/job/x"},
		// Unsupported hosts are skipped rather than half-recorded.
		{Company: "Nextdoor", SourceURL: "https://about.nextdoor.com/careers/1"},
		// A row with no company name can't produce a usable config entry.
		{Company: "", SourceURL: "https://jobs.lever.co/ghost/abc"},
	}

	boards := DiscoverBoards(jobs)

	if len(boards) != 3 {
		t.Fatalf("got %d boards, want 3: %+v", len(boards), boards)
	}

	byKey := map[string]Board{}
	for _, b := range boards {
		byKey[boardKey(b)] = b
	}

	if b, ok := byKey["greenhouse|andurilindustries"]; !ok || b.Company != "Anduril" {
		t.Errorf("greenhouse board wrong: %+v (present=%v)", b, ok)
	}
	if b, ok := byKey["workday|amat|wd1|External"]; !ok || b.Company != "Applied Materials" {
		t.Errorf("workday board wrong: %+v (present=%v)", b, ok)
	}
	if _, ok := byKey["lever|ghost"]; ok {
		t.Error("a row with no company name should not produce a board")
	}
}

func TestDiscoverBoardsIsDeterministic(t *testing.T) {
	// Generated config is committed to the repo, so unchanged input must produce
	// byte-identical output or every regeneration is an unreviewable diff.
	jobs := []models.Job{
		{Company: "Zeta", SourceURL: "https://jobs.lever.co/zeta/1"},
		{Company: "Alpha", SourceURL: "https://job-boards.greenhouse.io/alpha/jobs/1"},
		{Company: "Mid", SourceURL: "https://jobs.ashbyhq.com/mid/1"},
		{Company: "Beta", SourceURL: "https://beta.wd5.myworkdayjobs.com/Careers/job/x"},
	}

	first := DiscoverBoards(jobs)
	for i := 0; i < 5; i++ {
		next := DiscoverBoards(jobs)
		if len(next) != len(first) {
			t.Fatalf("length changed between runs: %d vs %d", len(next), len(first))
		}
		for j := range first {
			if boardKey(next[j]) != boardKey(first[j]) {
				t.Fatalf("order changed at %d: %q vs %q", j, boardKey(next[j]), boardKey(first[j]))
			}
		}
	}
}
