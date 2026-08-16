package sink

import (
	"bytes"
	"testing"
	"time"

	"jobdog/scraper-worker/streaming"

	"github.com/parquet-go/parquet-go"
)

func TestEncodeParquetRoundTrips(t *testing.T) {
	classifiedAt := time.Now().UTC().Truncate(time.Millisecond)
	rows := []Row{
		rowFromEnrichedPosting(streaming.EnrichedPosting{
			JobID:           "11111111-1111-1111-1111-111111111111",
			SourceJobID:     "gh-anduril-4520123",
			Title:           "Software Engineer, New Grad",
			Company:         "Anduril",
			ExperienceLevel: "NEW_GRAD",
			EntryType:       "NEW_GRAD_COHORT",
			GradYearMin:     2027,
			GradYearMax:     2027,
			RequiredSkills:  []string{"go", "kubernetes"},
			ClassifiedAt:    classifiedAt,
		}),
	}

	body, err := encodeParquet(rows)
	if err != nil {
		t.Fatalf("encodeParquet: %v", err)
	}
	if len(body) == 0 {
		t.Fatal("expected non-empty parquet bytes")
	}

	reader := parquet.NewGenericReader[Row](bytes.NewReader(body))
	defer reader.Close()

	got := make([]Row, 1)
	n, err := reader.Read(got)
	if n != 1 {
		t.Fatalf("read %d rows, want 1 (err=%v)", n, err)
	}

	if got[0].JobID != rows[0].JobID {
		t.Errorf("JobID = %q, want %q", got[0].JobID, rows[0].JobID)
	}
	if got[0].EntryType != "NEW_GRAD_COHORT" {
		t.Errorf("EntryType = %q, want NEW_GRAD_COHORT", got[0].EntryType)
	}
	if got[0].GradYearMin != 2027 {
		t.Errorf("GradYearMin = %d, want 2027", got[0].GradYearMin)
	}
	if len(got[0].RequiredSkills) != 2 || got[0].RequiredSkills[0] != "go" {
		t.Errorf("RequiredSkills = %v, want [go kubernetes]", got[0].RequiredSkills)
	}
}

func TestPartitionKeyIsDateOnly(t *testing.T) {
	r := Row{}
	at := time.Date(2026, 8, 16, 14, 30, 0, 0, time.UTC)
	if got := r.partitionKey(at); got != "date=2026-08-16" {
		t.Errorf("partitionKey = %q, want date=2026-08-16", got)
	}
}
