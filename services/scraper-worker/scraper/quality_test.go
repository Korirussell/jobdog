package scraper

import (
	"testing"
	"time"

	"jobdog/scraper-worker/models"
)

func TestAcceptListing(t *testing.T) {
	cases := []struct {
		name  string
		job   models.Job
		trust SourceTrust
		want  bool
	}{
		{"explicit new grad title", models.Job{Title: "Software Engineer, New Grad"}, TrustNone, true},
		{"internship", models.Job{Title: "Software Engineering Intern, Summer 2027"}, TrustNone, true},
		{"level one engineer", models.Job{Title: "Software Engineer I"}, TrustNone, true},
		{"sde one", models.Job{Title: "SDE 1"}, TrustNone, true},
		{"associate engineer", models.Job{Title: "Associate Software Engineer"}, TrustNone, true},
		{"graduate engineer", models.Job{Title: "Graduate Software Engineer"}, TrustNone, true},
		{
			name:  "no title signal but a stated 0-2 years",
			job:   models.Job{Title: "Software Engineer", DescriptionText: "You have 0-2 years of professional experience building web services."},
			trust: TrustNone, want: true,
		},
		{
			name:  "cohort language in the description",
			job:   models.Job{Title: "Software Engineer", DescriptionText: "This role is part of our university graduate program."},
			trust: TrustNone, want: true,
		},
		{
			name:  "an aggregator repo named for the cohort stands in for the missing text",
			job:   models.Job{Title: "Software Engineer", DescriptionText: "Software Engineer at Acme - Remote", SourceRepo: "vanshb03/New-Grad-2027"},
			trust: TrustNone, want: true,
		},

		// The cases the old exclusion-only filter let straight through.
		{"mid-level numbered title", models.Job{Title: "Software Engineer III"}, TrustNone, false},
		{"level two", models.Job{Title: "Software Engineer II"}, TrustNone, false},
		{"plain title, nothing else", models.Job{Title: "Software Engineer"}, TrustNone, false},
		{
			name:  "plain title that asks for real experience",
			job:   models.Job{Title: "Software Engineer", DescriptionText: "Requires 3+ years of experience with distributed systems."},
			trust: TrustNone, want: false,
		},
		{
			name:  "a stray 1+ year next to a 8+ year requirement is not entry level",
			job:   models.Job{Title: "Software Engineer", DescriptionText: "8+ years of experience building backends. 1+ year of experience with Kubernetes."},
			trust: TrustNone, want: false,
		},
		{"senior title", models.Job{Title: "Senior Software Engineer"}, TrustNone, false},
		{"leadership title", models.Job{Title: "Engineering Manager, New Grad Programs"}, TrustNone, false},
		{"early career but not technical", models.Job{Title: "Registered Nurse - New Grad"}, TrustNone, false},

		// Curated sources have already done the scoping; they only have to not
		// contradict it.
		{"curated: no signal needed", models.Job{Title: "Software Engineer", SourceRepo: "SimplifyJobs/Summer2027-Internships"}, TrustCurated, true},
		{"curated: non-technical title is still kept", models.Job{Title: "Technical Recruiter, University"}, TrustCurated, true},
		{"curated: senior title is still rejected", models.Job{Title: "Staff Software Engineer"}, TrustCurated, false},
		{
			name:  "curated: but not if the posting itself asks for experience",
			job:   models.Job{Title: "Software Engineer", DescriptionText: "Requires 5+ years of experience."},
			trust: TrustCurated, want: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			job := tc.job
			got, reason := AcceptListing(&job, tc.trust)
			if got != tc.want {
				t.Errorf("AcceptListing(%q) = %v (%s), want %v", job.Title, got, reason, tc.want)
			}
		})
	}
}

func TestTitleHasEarlyCareerSignal(t *testing.T) {
	yes := []string{
		"DFT Engineer - New College Grad",
		"Security Architect - New College Grad 2026",
		"Software Engineering Intern, NCCL - 2026",
		"Associate Software Engineer",
		"Software Engineer I",
		"Junior Backend Developer",
	}
	no := []string{
		"Software Engineer",
		"Senior HR Business Partner, Chip Design",
		"Staff Software Engineer",
		"Software Engineer III",
	}
	for _, title := range yes {
		if !TitleHasEarlyCareerSignal(title) {
			t.Errorf("TitleHasEarlyCareerSignal(%q) = false, want true", title)
		}
	}
	for _, title := range no {
		if TitleHasEarlyCareerSignal(title) {
			t.Errorf("TitleHasEarlyCareerSignal(%q) = true, want false", title)
		}
	}
}

func TestMaxYearsExperience(t *testing.T) {
	cases := []struct {
		description string
		wantMin     int
		wantMax     int
	}{
		{"No requirements stated.", -1, -1},
		{"0-2 years of experience", 0, 0},
		{"8+ years of experience. 1+ year of experience with Go.", 1, 8},
		{"3+ years of experience", 3, 3},
	}
	for _, tc := range cases {
		if got := MinYearsExperience(tc.description); got != tc.wantMin {
			t.Errorf("MinYearsExperience(%q) = %d, want %d", tc.description, got, tc.wantMin)
		}
		if got := MaxYearsExperience(tc.description); got != tc.wantMax {
			t.Errorf("MaxYearsExperience(%q) = %d, want %d", tc.description, got, tc.wantMax)
		}
	}
}

func TestIsPastSeason(t *testing.T) {
	oct2026 := time.Date(2026, time.October, 3, 0, 0, 0, 0, time.UTC)
	jun2026 := time.Date(2026, time.June, 3, 0, 0, 0, 0, time.UTC)

	cases := []struct {
		title string
		now   time.Time
		want  bool
	}{
		{"New Grad 2025: Software Engineer", oct2026, true},
		{"Software Engineer Intern, Summer 2026", oct2026, true},
		{"Software Engineer Intern, Summer 2026", jun2026, false},
		{"Software Engineer, New Grad 2026", oct2026, false},
		{"Software Engineering Intern - Summer 2027", oct2026, false},
		{"Software Engineer, New Grad", oct2026, false},
		{"Class of 2024 and 2027 Graduate Program", oct2026, false},
	}
	for _, tc := range cases {
		if got := IsPastSeason(tc.title, tc.now); got != tc.want {
			t.Errorf("IsPastSeason(%q, %s) = %v, want %v", tc.title, tc.now.Format("2006-01"), got, tc.want)
		}
	}
}
