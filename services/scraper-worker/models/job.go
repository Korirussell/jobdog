package models

import (
	"time"
)

type Job struct {
	ID                     string
	Source                 string
	SourceJobID            string
	SourceURL              string
	Title                  string
	Company                string
	Location               string
	EmploymentType         string
	DescriptionText        string
	DescriptionHash        string
	Status                 string
	MinimumYearsExperience *int
	EducationLevel         *string
	ExperienceLevel        string
	RoleCategory           string
	LocationScope          string
	SalaryRaw              *string
	PostedAt               *time.Time
	ScrapedAt              time.Time
	// SourceRepo is the aggregator "owner/repo" this job was parsed from
	// ("vanshb03/New-Grad-2027"), when it came from an aggregator README.
	// Never persisted — it exists only to give the grad-cohort classifier a
	// hint when the posting text itself doesn't state a graduation year.
	SourceRepo string
}

type JobRequirementProfile struct {
	JobID            string
	RequiredSkills   []string
	PreferredSkills  []string
	ExtractionMethod string
}

// GradClassification is the persisted form of a graduation-cohort verdict,
// mirroring scraper.GradClassification without the scraper-only fields. It lives
// here so the repository does not depend on the scraper package.
type GradClassification struct {
	EntryType  string
	YearMin    int
	YearMax    int
	Source     string
	Confidence float64
	Evidence   string
}
