// Package streaming implements the Kafka-compatible ingestion pipeline
// described in docs/kafka.md: scrapers publish raw postings, a classifier
// consumer enriches and persists them, and the enriched result is republished
// for anything downstream (Spark/Databricks trend aggregation) to read.
//
// This is opt-in. Nothing here runs unless KAFKA_BROKERS is set — with it
// unset, scrapers keep upserting directly, exactly as before this package
// existed.
package streaming

import (
	"encoding/json"
	"time"

	"jobdog/scraper-worker/models"
)

// Topic names. See docs/kafka.md for why these two specifically, and why
// keyed by source_job_id.
const (
	TopicRawPostings      = "raw.postings"
	TopicEnrichedPostings = "enriched.postings"
)

// RawPostingsPartitions matches docs/kafka.md's stated partition count:
// enough to parallelize consumers past current volume, low enough not to
// waste file handles on a shared box. Never decrease this once real traffic
// depends on it — shrinking changes the key→partition mapping and breaks
// per-key ordering across the resize.
const RawPostingsPartitions = 6

// RawPosting is exactly what a scraper saw, unprocessed — the raw.postings
// message body. Deliberately a thin wrapper over models.Job rather than a
// separate hand-maintained struct, so a new scraped field doesn't need a
// second definition kept in sync.
type RawPosting struct {
	Job         models.Job `json:"job"`
	ScrapedAt   time.Time  `json:"scrapedAt"`
	ProducedBy  string     `json:"producedBy"`
}

// EnrichedPosting is the enriched.postings message body: the raw posting plus
// what the classifier consumer decided about it. Republishing the verdict
// (not just writing it to Postgres) is what lets Spark/Databricks batch jobs
// read hiring-trend aggregates without querying the serving database.
type EnrichedPosting struct {
	JobID           string    `json:"jobId"`
	SourceJobID     string    `json:"sourceJobId"`
	Title           string    `json:"title"`
	Company         string    `json:"company"`
	ExperienceLevel string    `json:"experienceLevel"`
	EntryType       string    `json:"entryType"`
	GradYearMin     int       `json:"gradYearMin,omitempty"`
	GradYearMax     int       `json:"gradYearMax,omitempty"`
	RequiredSkills  []string  `json:"requiredSkills,omitempty"`
	PreferredSkills []string  `json:"preferredSkills,omitempty"`
	ClassifiedAt    time.Time `json:"classifiedAt"`
}

func marshalRawPosting(p RawPosting) ([]byte, error) {
	return json.Marshal(p)
}

func unmarshalRawPosting(data []byte) (RawPosting, error) {
	var p RawPosting
	err := json.Unmarshal(data, &p)
	return p, err
}

func marshalEnrichedPosting(p EnrichedPosting) ([]byte, error) {
	return json.Marshal(p)
}
