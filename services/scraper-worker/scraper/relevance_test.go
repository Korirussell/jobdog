package scraper

import "testing"

func TestIsEarlyCareerRelevant(t *testing.T) {
	keep := []string{
		// The category the old intern-only filter silently discarded.
		"Software Engineer, New Grad",
		"Software Engineer I",
		"Associate Software Engineer",
		"University Graduate, Software Engineer",
		"Early Career Software Engineer",
		"Campus Hire - Backend Engineer",
		"Junior Data Engineer",
		"Software Engineer Intern",
		"Backend Co-op",
		// Generic titles are kept deliberately: the description decides, and the
		// cohort classifier cannot run on a posting we threw away.
		"Software Engineer",
		"Product Engineer",
	}
	for _, title := range keep {
		if !IsEarlyCareerRelevant(title) {
			t.Errorf("IsEarlyCareerRelevant(%q) = false, want true", title)
		}
	}

	drop := []string{
		"Senior Software Engineer",
		"Staff Software Engineer",
		"Principal Engineer",
		"Engineering Manager",
		"Director of Engineering",
		"VP of Product",
		"Head of Infrastructure",
		"Chief Technology Officer",
		"Software Architect",
		"",
	}
	for _, title := range drop {
		if IsEarlyCareerRelevant(title) {
			t.Errorf("IsEarlyCareerRelevant(%q) = true, want false", title)
		}
	}

	// An internship stays in scope even when the title also reads senior.
	if !IsEarlyCareerRelevant("Senior Thesis Intern") {
		t.Error("an internship should be kept even with a senior-sounding title")
	}
}
