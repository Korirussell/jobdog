package scraper

import "testing"

func TestAshbyEmploymentType(t *testing.T) {
	cases := []struct {
		employmentType string
		title          string
		want           string
	}{
		{"FullTime", "Staff Backend Engineer", "FULL_TIME"},
		{"PartTime", "Support Engineer", "PART_TIME"},
		{"Intern", "Software Engineer", "INTERNSHIP"},
		{"Contract", "Designer", "CONTRACT"},
		{"Temporary", "Analyst", "CONTRACT"},
		{"", "Engineer", "FULL_TIME"},
		// Boards commonly tag internships FullTime because the hours are full-time
		// for a fixed term; the title is the more reliable signal.
		{"FullTime", "Software Engineer Intern", "INTERNSHIP"},
	}

	for _, tc := range cases {
		if got := ashbyEmploymentType(tc.employmentType, tc.title); got != tc.want {
			t.Errorf("ashbyEmploymentType(%q, %q) = %q, want %q", tc.employmentType, tc.title, got, tc.want)
		}
	}
}

func TestParseAshbyPublishedAt(t *testing.T) {
	t.Run("parses an RFC3339 timestamp", func(t *testing.T) {
		got := parseAshbyPublishedAt("2026-03-18T18:48:05.747+00:00", "id")
		if got == nil {
			t.Fatal("expected a parsed time, got nil")
		}
		if got.Format("2006-01-02") != "2026-03-18" {
			t.Errorf("got %s, want 2026-03-18", got.Format("2006-01-02"))
		}
	})

	t.Run("unparseable values leave the date unset", func(t *testing.T) {
		for _, bad := range []string{"", "not a date", "2026-03-18"} {
			if got := parseAshbyPublishedAt(bad, "id"); got != nil {
				t.Errorf("parseAshbyPublishedAt(%q) = %v, want nil", bad, got)
			}
		}
	})
}

func TestAshbyLocation(t *testing.T) {
	cases := []struct {
		name    string
		posting ashbyJob
		want    string
	}{
		{"onsite", ashbyJob{Location: "New York"}, "New York"},
		{"remote with a city", ashbyJob{Location: "New York", IsRemote: true}, "New York (Remote)"},
		{"remote with no city", ashbyJob{Location: "", IsRemote: true}, "Remote"},
		// Don't produce "Remote (Remote)" when the board already says so.
		{"already labelled remote", ashbyJob{Location: "Remote - US", IsRemote: true}, "Remote - US"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ashbyLocation(tc.posting); got != tc.want {
				t.Errorf("ashbyLocation() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestAshbySalary(t *testing.T) {
	summary := "$207K – $259K + Token Compensation"
	got := ashbySalary(ashbyJob{Compensation: ashbyCompensation{CompensationTierSummary: summary}})
	if got == nil || *got != summary {
		t.Errorf("got %v, want %q", got, summary)
	}

	// Most boards don't publish compensation; absent must be nil rather than "".
	if got := ashbySalary(ashbyJob{}); got != nil {
		t.Errorf("expected nil for a posting with no compensation, got %q", *got)
	}
	if got := ashbySalary(ashbyJob{Compensation: ashbyCompensation{CompensationTierSummary: "   "}}); got != nil {
		t.Errorf("expected nil for whitespace-only compensation, got %q", *got)
	}
}
