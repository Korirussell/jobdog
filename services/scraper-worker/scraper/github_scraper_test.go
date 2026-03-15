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

	jobs := s.parseMarkdownTable(content)
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
