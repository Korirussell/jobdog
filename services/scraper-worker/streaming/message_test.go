package streaming

import (
	"testing"
	"time"

	"jobdog/scraper-worker/models"
)

func TestRawPostingRoundTrips(t *testing.T) {
	postedAt := time.Now().UTC().Truncate(time.Second)
	original := RawPosting{
		Job: models.Job{
			Source:          "greenhouse",
			SourceJobID:     "gh-anduril-4520123",
			SourceURL:       "https://job-boards.greenhouse.io/andurilindustries/jobs/4520123",
			Title:           "Software Engineer, New Grad",
			Company:         "Anduril",
			Location:        "Costa Mesa, CA",
			EmploymentType:  "FULL_TIME",
			DescriptionText: "Must graduate between Dec 2026 and Aug 2027.",
			Status:          "ACTIVE",
			PostedAt:        &postedAt,
		},
		ScrapedAt:  time.Now().UTC().Truncate(time.Second),
		ProducedBy: "scraper-worker",
	}

	body, err := marshalRawPosting(original)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	decoded, err := unmarshalRawPosting(body)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if decoded.Job.SourceJobID != original.Job.SourceJobID {
		t.Errorf("SourceJobID = %q, want %q", decoded.Job.SourceJobID, original.Job.SourceJobID)
	}
	if decoded.Job.Company != original.Job.Company {
		t.Errorf("Company = %q, want %q", decoded.Job.Company, original.Job.Company)
	}
	if decoded.Job.DescriptionText != original.Job.DescriptionText {
		t.Errorf("DescriptionText = %q, want %q", decoded.Job.DescriptionText, original.Job.DescriptionText)
	}
	if decoded.ProducedBy != original.ProducedBy {
		t.Errorf("ProducedBy = %q, want %q", decoded.ProducedBy, original.ProducedBy)
	}
	if decoded.Job.PostedAt == nil || !decoded.Job.PostedAt.Equal(*original.Job.PostedAt) {
		t.Errorf("PostedAt = %v, want %v", decoded.Job.PostedAt, original.Job.PostedAt)
	}
}

func TestEnrichedPostingMarshalsCleanly(t *testing.T) {
	body, err := marshalEnrichedPosting(EnrichedPosting{
		JobID:           "11111111-1111-1111-1111-111111111111",
		SourceJobID:     "gh-anduril-4520123",
		Title:           "Software Engineer, New Grad",
		Company:         "Anduril",
		ExperienceLevel: "NEW_GRAD",
		EntryType:       "NEW_GRAD_COHORT",
		GradYearMin:     2027,
		GradYearMax:     2027,
		RequiredSkills:  []string{"Go", "Kubernetes"},
		ClassifiedAt:    time.Now(),
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if len(body) == 0 {
		t.Fatal("expected non-empty JSON body")
	}
}
