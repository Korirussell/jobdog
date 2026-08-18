package scraper

import "testing"

func TestExtractGradWindow(t *testing.T) {
	cases := []struct {
		name           string
		title          string
		description    string
		sourceURL      string
		aggregatorRepo string
		wantMin        int
		wantMax        int
		wantRel        bool
	}{
		{
			name:        "explicit range across two years",
			title:       "Software Engineer, University Graduate",
			description: "You must be graduating between December 2026 and June 2027 to be eligible.",
			wantMin:     2026,
			wantMax:     2027,
		},
		{
			name:        "class of phrasing",
			title:       "Software Engineer",
			description: "This role is open to the class of 2027.",
			wantMin:     2027,
			wantMax:     2027,
		},
		{
			name:        "expected graduation date",
			title:       "Associate Software Engineer",
			description: "Requirements: expected graduation date of May 2026 with a BS in Computer Science.",
			wantMin:     2026,
			wantMax:     2026,
		},
		{
			name:      "year lives in the ATS slug only",
			title:     "Software Engineer - DevOps",
			sourceURL: "https://amat.wd1.myworkdayjobs.com/External/job/GloucesterMA/XMLNAME-2027-Software-Engineer--DevOps---New-College-Grad-_R2625762",
			wantMin:   2027,
			wantMax:   2027,
		},
		{
			name:        "relative window with no calendar year",
			title:       "Software Engineer, Early Career",
			description: "Candidates must have graduated within the last 12 months of the start date.",
			wantRel:     true,
		},
		{
			name:        "copyright year is not a graduation year",
			title:       "Software Engineer",
			description: "Copyright 2026 Acme Corp. All rights reserved. A degree in a technical field is required.",
			wantMin:     0,
			wantMax:     0,
		},
		{
			name:        "incidental year outside grad context is ignored",
			title:       "Software Engineer",
			description: "Our fiscal year 2027 roadmap is ambitious. You will build distributed systems.",
			wantMin:     0,
			wantMax:     0,
		},
		{
			name:        "no graduation signal at all",
			title:       "Software Engineer",
			description: "Join our team building great products for millions of users worldwide.",
			wantMin:     0,
			wantMax:     0,
		},
		{
			name:           "year lives in the aggregator repo name only",
			title:          "Software Engineer I",
			description:    "Software Engineer I at Acme - Remote",
			aggregatorRepo: "vanshb03/New-Grad-2027",
			wantMin:        2027,
			wantMax:        2027,
		},
		{
			name:           "year glued onto a word in the repo name",
			title:          "Software Engineer, New Grad",
			description:    "Software Engineer, New Grad at Acme - Remote",
			aggregatorRepo: "SimplifyJobs/Summer2027-Internships",
			wantMin:        2027,
			wantMax:        2027,
		},
		{
			name:           "undated aggregator repo carries no year",
			title:          "Software Engineer I",
			description:    "Software Engineer I at Acme - Remote",
			aggregatorRepo: "SimplifyJobs/New-Grad-Positions",
			wantMin:        0,
			wantMax:        0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotMin, gotMax, gotRel, _ := ExtractGradWindow(tc.title, tc.description, tc.sourceURL, tc.aggregatorRepo)
			if gotMin != tc.wantMin || gotMax != tc.wantMax || gotRel != tc.wantRel {
				t.Errorf("ExtractGradWindow() = (%d, %d, rel=%v), want (%d, %d, rel=%v)",
					gotMin, gotMax, gotRel, tc.wantMin, tc.wantMax, tc.wantRel)
			}
		})
	}
}

func TestMinYearsExperience(t *testing.T) {
	cases := []struct {
		name        string
		description string
		want        int
	}{
		{"no experience stated", "Build great software with a great team.", -1},
		{"single requirement", "We require 3+ years of professional experience.", 3},
		{"range takes the lower bound", "3-5 years of experience in backend development.", 3},
		{"multiple mentions take the smallest", "5+ years of experience preferred. 2 years of experience required.", 2},
		{"zero years is entry level", "0 years of experience required — we will train you.", 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := MinYearsExperience(tc.description); got != tc.want {
				t.Errorf("MinYearsExperience(%q) = %d, want %d", tc.description, got, tc.want)
			}
		})
	}
}

func TestClassifyGradCohort(t *testing.T) {
	// Padding to push descriptions past the 400-char substance threshold, so the
	// classifier is judged on its rules rather than on "not enough text".
	const filler = "You will work alongside experienced engineers on production systems that serve millions of users. " +
		"Responsibilities include designing, building, testing and shipping backend services, participating in code " +
		"review, and collaborating across product and design. We offer competitive compensation, comprehensive health " +
		"benefits, and a generous learning stipend for every engineer on the team. "

	cases := []struct {
		name           string
		title          string
		description    string
		sourceURL      string
		aggregatorRepo string
		wantType       EntryType
		wantMin        int
	}{
		{
			name:        "cohort-gated 2027 new grad",
			title:       "Software Engineer, New Grad",
			description: filler + "You must graduate with a Bachelor's degree between December 2026 and August 2027.",
			wantType:    EntryTypeNewGradCohort,
			wantMin:     2026,
		},
		{
			name:        "entry level with no cohort gate is not a new grad role",
			title:       "Software Engineer 1",
			description: filler + "This is a full-time position with an immediate start date.",
			wantType:    EntryTypeEntryLevelOpen,
		},
		{
			name:        "associate title asking for years of experience is experienced",
			title:       "Associate Software Engineer",
			description: filler + "We are looking for someone with 3+ years of experience shipping web applications.",
			wantType:    EntryTypeExperienced,
		},
		{
			name:        "cohort language without a year is still cohort-gated",
			title:       "Software Engineer, University Graduate",
			description: filler + "This role is part of our campus hire program for graduating students.",
			wantType:    EntryTypeNewGradCohort,
			wantMin:     0,
		},
		{
			name:        "intern title wins over everything",
			title:       "Software Engineer Intern",
			description: filler + "Open to the class of 2027.",
			wantType:    EntryTypeIntern,
		},
		{
			name:        "senior title wins over everything",
			title:       "Senior Software Engineer",
			description: filler + "A degree completed in 2026 is fine.",
			wantType:    EntryTypeExperienced,
		},
		{
			name:        "no signal in either field",
			title:       "Software Engineer",
			description: filler,
			wantType:    EntryTypeUnknown,
		},
		{
			// This is the exact coverage gap the aggregator-repo signal fixes: a
			// thin, synthesized aggregator row with a plain "Level 1" title used to
			// fall through to EntryTypeEntryLevelOpen and get filtered out of the
			// new-grad cohort entirely, even though vanshb03/New-Grad-2027 only
			// lists roles it already verified are 2027-eligible.
			name:           "thin aggregator row with no explicit year is rescued by the repo name",
			title:          "Software Engineer I",
			description:    "Software Engineer I at Acme - Remote",
			aggregatorRepo: "vanshb03/New-Grad-2027",
			wantType:       EntryTypeNewGradCohort,
			wantMin:        2027,
		},
		{
			name:           "undated aggregator repo still marks the cohort, just without a year",
			title:          "Software Engineer I",
			description:    "Software Engineer I at Acme - Remote",
			aggregatorRepo: "SimplifyJobs/New-Grad-Positions",
			wantType:       EntryTypeNewGradCohort,
			wantMin:        0,
		},
		{
			name:           "intern title still wins over an aggregator repo hint",
			title:          "Software Engineer Intern",
			description:    "Software Engineer Intern at Acme - Remote",
			aggregatorRepo: "vanshb03/Summer2027-Internships",
			wantType:       EntryTypeIntern,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ClassifyGradCohort(tc.title, tc.description, tc.sourceURL, tc.aggregatorRepo)
			if got.EntryType != tc.wantType {
				t.Errorf("EntryType = %q, want %q (evidence: %q)", got.EntryType, tc.wantType, got.Evidence)
			}
			if got.YearMin != tc.wantMin {
				t.Errorf("YearMin = %d, want %d", got.YearMin, tc.wantMin)
			}
		})
	}
}

func TestNeedsLLMReview(t *testing.T) {
	const longDescription = "This is a substantive job description with plenty of detail about the role, the team, " +
		"the technology stack, the interview process, the compensation band, the benefits package, the location " +
		"policy, and the day-to-day responsibilities that the successful candidate will take on once they join us " +
		"and get through onboarding, plus the growth path we expect them to follow over their first two years " +
		"here. It comfortably clears the substance threshold for review escalation."

	t.Run("high-confidence regex verdict is not escalated", func(t *testing.T) {
		c := GradClassification{EntryType: EntryTypeIntern, Source: GradSourceRegex, Confidence: 0.95}
		if NeedsLLMReview(c, longDescription) {
			t.Error("expected no escalation for a high-confidence regex verdict")
		}
	})

	t.Run("thin description is never escalated", func(t *testing.T) {
		c := GradClassification{EntryType: EntryTypeUnknown, Source: GradSourceNone}
		if NeedsLLMReview(c, "Software Engineer at Acme - Remote") {
			t.Error("expected no escalation when there is no description to reason over")
		}
	})

	t.Run("ambiguous entry-level posting is escalated", func(t *testing.T) {
		c := GradClassification{EntryType: EntryTypeEntryLevelOpen, Source: GradSourceNone}
		if !NeedsLLMReview(c, longDescription) {
			t.Error("expected escalation for an ambiguous entry-level posting")
		}
	})

	t.Run("undated cohort is escalated to pin down the year", func(t *testing.T) {
		c := GradClassification{EntryType: EntryTypeNewGradCohort, Source: GradSourceRegex, Confidence: 0.6}
		if !NeedsLLMReview(c, longDescription) {
			t.Error("expected escalation for a cohort posting with no year")
		}
	})
}
