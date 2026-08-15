package scraper

import "testing"

func TestParseMarkdownTable_ParsesSimplifyHTMLTable(t *testing.T) {
	s := &GitHubScraper{}
	content := `<table>
<tbody>
<tr>
<td><strong><a href="https://simplify.jobs/c/Cadence-Design-Systems">Cadence Design Systems</a></strong></td>
<td>Product Engineering Intern - Agentic AI</td>
<td>San Jose, CA</td>
<td><div align="center"><a href="https://cadence.wd1.myworkdayjobs.com/job/123"><img src="https://i.imgur.com/fbjwDvo.png" width="50" alt="Apply"></a> <a href="https://simplify.jobs/p/c73a883d"><img src="https://i.imgur.com/aVnQdox.png" width="26" alt="Simplify"></a></div></td>
<td>0d</td>
</tr>
<tr>
<td>↳</td>
<td>Data Analytics Research 🎓</td>
<td>Cambridge, MA</td>
<td><div align="center"><a href="https://modernatx.wd1.myworkdayjobs.com/job/456"><img src="https://i.imgur.com/fbjwDvo.png" width="50" alt="Apply"></a></div></td>
<td>1d</td>
</tr>
</tbody>
</table>`

	jobs := s.parseMarkdownTable(content, "INTERNSHIP", "github-simplifyjobs")
	if len(jobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(jobs))
	}

	if jobs[0].Company != "Cadence Design Systems" {
		t.Fatalf("expected first company to be Cadence Design Systems, got %q", jobs[0].Company)
	}

	if jobs[0].SourceURL != "https://cadence.wd1.myworkdayjobs.com/job/123" {
		t.Fatalf("expected first apply url to be external application url, got %q", jobs[0].SourceURL)
	}

	if jobs[0].SourceJobID == "" {
		t.Fatalf("expected first job to have a source job id")
	}

	if jobs[1].Company != "Cadence Design Systems" {
		t.Fatalf("expected arrow row to inherit previous company, got %q", jobs[1].Company)
	}

	if jobs[1].Title != "Data Analytics Research 🎓" {
		t.Fatalf("expected second title to parse, got %q", jobs[1].Title)
	}

	if jobs[1].SourceJobID == "" {
		t.Fatalf("expected second job to have a source job id")
	}

	if jobs[0].SourceJobID == jobs[1].SourceJobID {
		t.Fatalf("expected parsed jobs to have distinct source job ids")
	}
}

// TestParsesTableWithAttributes guards a silent data-loss bug: SimplifyJobs'
// New-Grad-Positions README opens its tables as `<table style="...">`, and an
// exact-match check for "<table>" routed all 2,000+ rows into the markdown
// parser, which found no pipe-delimited rows and returned an empty slice. No
// error, no warning — the entire new-grad feed just vanished.
func TestParsesTableWithAttributes(t *testing.T) {
	readme := `# New Grad Positions
<table style="width: 100%; border-collapse: collapse;">
<thead><tr><td>Company</td><td>Role</td><td>Location</td><td>Application</td><td>Age</td></tr></thead>
<tbody>
<tr>
<td><strong><a href="https://simplify.jobs/c/Anduril">Anduril</a></strong></td>
<td>Software Engineer, New Grad</td>
<td>Costa Mesa, CA</td>
<td><div align="center"><a href="https://job-boards.greenhouse.io/andurilindustries/jobs/4520123"><img src="x" alt="Apply"></a> <a href="https://simplify.jobs/p/abc"><img src="y" alt="Simplify"></a></div></td>
<td>0d</td>
</tr>
</tbody>
</table>`

	s := &GitHubScraper{}
	jobs := s.parseMarkdownTable(readme, "FULL_TIME", "github-simplifyjobs")

	if len(jobs) != 1 {
		t.Fatalf("parsed %d jobs from an attributed <table>, want 1", len(jobs))
	}
	if jobs[0].Company != "Anduril" {
		t.Errorf("Company = %q, want Anduril", jobs[0].Company)
	}
	if jobs[0].EmploymentType != "FULL_TIME" {
		t.Errorf("EmploymentType = %q, want FULL_TIME", jobs[0].EmploymentType)
	}
	// The apply link must be the ATS URL, not the Simplify redirect — the ATS URL
	// is what board discovery reads to find the company's job board.
	if jobs[0].SourceURL != "https://job-boards.greenhouse.io/andurilindustries/jobs/4520123" {
		t.Errorf("SourceURL = %q, want the Greenhouse apply URL", jobs[0].SourceURL)
	}
}

// TestParseMarkdownTable_ParsesHTMLAnchorInsideMarkdownPipeTable guards the
// vansh/Ouckah repo format: a genuine markdown pipe table (not an HTML
// <table>), but with an <a href><img></a> badge inside the Application
// column instead of a plain markdown link. Before this fix, the markdown
// link regex found nothing here and every row was silently dropped.
func TestParseMarkdownTable_ParsesHTMLAnchorInsideMarkdownPipeTable(t *testing.T) {
	content := `| Company | Role | Location | Application/Link | Date Posted |
| ------- | ---- | -------- | ---------------- | ----------- |
| **DV Group** | Quantitative Risk Intern | Chicago, IL | <a href="https://job-boards.greenhouse.io/dvtrading/jobs/4719118005?utm_source=github-vansh-ouckah"><img src="https://i.imgur.com/u1KNU8z.png" width="118" alt="Apply"></a> | Aug 06 |
`

	s := &GitHubScraper{}
	jobs := s.parseMarkdownTable(content, "INTERNSHIP", "github-vanshb03")

	if len(jobs) != 1 {
		t.Fatalf("parsed %d jobs from a markdown table with HTML anchor links, want 1", len(jobs))
	}
	if jobs[0].Company != "DV Group" {
		t.Errorf("Company = %q, want DV Group (bold markdown stripped)", jobs[0].Company)
	}
	// Tracking query params must be stripped so the same posting scraped from a
	// different aggregator (a different utm_source) dedupes to the same row.
	if jobs[0].SourceURL != "https://job-boards.greenhouse.io/dvtrading/jobs/4719118005" {
		t.Errorf("SourceURL = %q, want the canonical Greenhouse URL with tracking params stripped", jobs[0].SourceURL)
	}
	if jobs[0].Source != "github-vanshb03" {
		t.Errorf("Source = %q, want github-vanshb03", jobs[0].Source)
	}
}

// TestCanonicalizeApplyURL_DedupesAcrossAggregatorTrackingParams is the crux of
// cross-aggregator dedup: two aggregators linking the identical ATS posting
// with different tracking query params must canonicalize to the same URL, so
// UpsertJob's ON CONFLICT (source_url) treats them as one job, not two.
func TestCanonicalizeApplyURL_DedupesAcrossAggregatorTrackingParams(t *testing.T) {
	fromSimplify := canonicalizeApplyURL("https://job-boards.greenhouse.io/andurilindustries/jobs/4520123?utm_source=Simplify")
	fromVansh := canonicalizeApplyURL("https://job-boards.greenhouse.io/andurilindustries/jobs/4520123?utm_source=github-vansh-ouckah")

	if fromSimplify != fromVansh {
		t.Fatalf("expected canonicalized URLs to match, got %q and %q", fromSimplify, fromVansh)
	}
	if fromSimplify != "https://job-boards.greenhouse.io/andurilindustries/jobs/4520123" {
		t.Errorf("canonicalizeApplyURL result = %q, want query string stripped", fromSimplify)
	}
}
