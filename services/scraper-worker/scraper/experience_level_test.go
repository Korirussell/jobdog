package scraper

import "testing"

func TestClassifyExperienceLevel(t *testing.T) {
	cases := []struct {
		name        string
		title       string
		description string
		want        string
	}{
		{"clear intern title", "Software Engineer Intern", "", "INTERN"},
		{"co-op title", "Backend Co-op", "", "INTERN"},
		{"clear new grad title", "Software Engineer I - New Grad", "", "NEW_GRAD"},
		{"entry level phrasing", "Junior Software Engineer", "0-1 years of experience", "NEW_GRAD"},
		{"senior title", "Senior Software Engineer", "", "SENIOR"},
		{"staff title excludes new grad", "Staff Engineer", "", "SENIOR"},
		{"years requirement signals senior", "Software Engineer", "5+ years of experience required", "SENIOR"},
		{"no signal either way", "Software Engineer", "Join our team building great products.", "UNKNOWN"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ClassifyExperienceLevel(tc.title, tc.description)
			if got != tc.want {
				t.Errorf("ClassifyExperienceLevel(%q, %q) = %q, want %q", tc.title, tc.description, got, tc.want)
			}
		})
	}
}
