// Package sink implements the S3 (or any S3-compatible store — R2, MinIO)
// half of the pipeline described in docs/kafka.md's "Spark aggregation"
// section: it consumes enriched.postings and writes Parquet files that
// Databricks reads in a batch job. Like the streaming package, this is
// opt-in — nothing runs unless S3_BUCKET is configured.
package sink

import (
	"time"

	"jobdog/scraper-worker/streaming"
)

// Row is the Parquet schema Databricks reads. A flat struct rather than
// reusing streaming.EnrichedPosting directly: Parquet field names and types
// are a storage contract that outlives any particular Go struct, so it's
// worth keeping deliberate and separate from the Kafka message shape even
// though the two are similar today.
type Row struct {
	JobID           string   `parquet:"job_id"`
	SourceJobID     string   `parquet:"source_job_id"`
	Title           string   `parquet:"title"`
	Company         string   `parquet:"company"`
	ExperienceLevel string   `parquet:"experience_level"`
	EntryType       string   `parquet:"entry_type"`
	GradYearMin     int32    `parquet:"grad_year_min,optional"`
	GradYearMax     int32    `parquet:"grad_year_max,optional"`
	RequiredSkills  []string `parquet:"required_skills,list"`
	PreferredSkills []string `parquet:"preferred_skills,list"`
	ClassifiedAt    int64    `parquet:"classified_at,timestamp"`
}

func rowFromEnrichedPosting(p streaming.EnrichedPosting) Row {
	return Row{
		JobID:           p.JobID,
		SourceJobID:     p.SourceJobID,
		Title:           p.Title,
		Company:         p.Company,
		ExperienceLevel: p.ExperienceLevel,
		EntryType:       p.EntryType,
		GradYearMin:     int32(p.GradYearMin),
		GradYearMax:     int32(p.GradYearMax),
		RequiredSkills:  p.RequiredSkills,
		PreferredSkills: p.PreferredSkills,
		ClassifiedAt:    p.ClassifiedAt.UnixMilli(),
	}
}

// PartitionKey returns the date partition (UTC) a row belongs under —
// s3://bucket/prefix/date=2026-08-16/part-<uuid>.parquet — matching the
// Hive-style partitioning Databricks/Spark expect for partition pruning.
func (r Row) partitionKey(classifiedAt time.Time) string {
	return "date=" + classifiedAt.UTC().Format("2006-01-02")
}
