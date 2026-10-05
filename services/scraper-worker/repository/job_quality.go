package repository

import (
	"fmt"
	"time"

	"github.com/lib/pq"
)

// ActiveSourceJobIDs returns which of the given source_job_ids are already
// stored as ACTIVE jobs for a source. Lets a scraper that can name a posting
// from its list response alone skip the per-posting detail fetch for everything
// it already has.
func (r *JobRepository) ActiveSourceJobIDs(source string, ids []string) (map[string]bool, error) {
	return r.idSet(`
		SELECT source_job_id FROM jobs
		WHERE source = $1 AND status = 'ACTIVE' AND source_job_id = ANY($2)
	`, source, pq.Array(ids), len(ids))
}

// TouchSourceJobs marks postings as seen this cycle without rewriting them, so
// a posting that is still listed does not age into the stale-job sweep.
func (r *JobRepository) TouchSourceJobs(source string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	now := time.Now()
	_, err := r.db.Exec(`
		UPDATE jobs SET scraped_at = $1, updated_at = $1
		WHERE source = $2 AND source_job_id = ANY($3)
	`, now, source, pq.Array(ids))
	if err != nil {
		return fmt.Errorf("failed to touch %s jobs: %w", source, err)
	}
	return nil
}

// RecentlyRejected returns which of the given postings were rejected by the
// ingest gate within the window. Rejected postings are never stored, so without
// this a scraper would re-fetch and re-reject the same ones every cycle.
func (r *JobRepository) RecentlyRejected(source string, ids []string, within time.Duration) (map[string]bool, error) {
	return r.idSet(`
		SELECT source_job_id FROM scrape_rejections
		WHERE source = $1 AND source_job_id = ANY($2) AND rejected_at > $3
	`, source, pq.Array(ids), len(ids), time.Now().Add(-within))
}

// RecordRejections remembers postings the ingest gate turned down.
func (r *JobRepository) RecordRejections(source string, ids []string, reason string) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.db.Exec(`
		INSERT INTO scrape_rejections (source, source_job_id, reason, rejected_at)
		SELECT $1, unnest($2::text[]), $3, $4
		ON CONFLICT (source, source_job_id)
		DO UPDATE SET reason = EXCLUDED.reason, rejected_at = EXCLUDED.rejected_at
	`, source, pq.Array(ids), reason, time.Now())
	if err != nil {
		return fmt.Errorf("failed to record %s rejections: %w", source, err)
	}
	return nil
}

func (r *JobRepository) idSet(query, source string, ids any, count int, extra ...any) (map[string]bool, error) {
	out := map[string]bool{}
	if count == 0 {
		return out, nil
	}
	args := append([]any{source, ids}, extra...)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// CloseNonQualifyingActiveJobs closes every ACTIVE posting the site would
// never show — anything not classified as an internship, new-grad or open
// entry-level role — except rows from the curated aggregator lists, whose own
// curation is the signal. Both tabs query on entry_type, so these rows were
// invisible already; they were still being stored, liveness-checked and
// deduplicated every cycle. Rows younger than 15 minutes are left alone: the
// scraper classifies a posting just after inserting it, and this must not
// close one in that gap.
func (r *JobRepository) CloseNonQualifyingActiveJobs() (int64, error) {
	result, err := r.db.Exec(`
		UPDATE jobs SET status = 'CLOSED', updated_at = $1
		WHERE status = 'ACTIVE'
		  AND created_at < $2
		  AND (
		        entry_type = 'EXPERIENCED'
		     OR ((entry_type IS NULL OR entry_type = 'UNKNOWN') AND source NOT LIKE 'github-%')
		  )
	`, time.Now(), time.Now().Add(-15*time.Minute))
	if err != nil {
		return 0, fmt.Errorf("failed to close non-qualifying jobs: %w", err)
	}
	return result.RowsAffected()
}

// ActiveJobTitle is an ACTIVE posting's id and title.
type ActiveJobTitle struct {
	ID    string
	Title string
}

// ActiveJobsWithYearInTitle returns ACTIVE postings whose title mentions a
// year ("Summer 2025 Intern", "New Grad 2026"), the candidates for a past
// season.
func (r *JobRepository) ActiveJobsWithYearInTitle() ([]ActiveJobTitle, error) {
	rows, err := r.db.Query(`SELECT id, title FROM jobs WHERE status = 'ACTIVE' AND title ~ '20[2-3][0-9]'`)
	if err != nil {
		return nil, fmt.Errorf("failed to query year-titled jobs: %w", err)
	}
	defer rows.Close()

	var out []ActiveJobTitle
	for rows.Next() {
		var j ActiveJobTitle
		if err := rows.Scan(&j.ID, &j.Title); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

// CloseJobsByID marks the given jobs CLOSED.
func (r *JobRepository) CloseJobsByID(ids []string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result, err := r.db.Exec(`
		UPDATE jobs SET status = 'CLOSED', updated_at = $1
		WHERE status = 'ACTIVE' AND id = ANY($2::uuid[])
	`, time.Now(), pq.Array(ids))
	if err != nil {
		return 0, fmt.Errorf("failed to close jobs: %w", err)
	}
	return result.RowsAffected()
}

// SourceStat is one company-on-one-source's contribution to the board.
type SourceStat struct {
	Source   string
	Company  string
	Active   int
	Visible  int
	Closed   int
	LastSeen time.Time
}

// SourceStats reports, per source and company, how many postings are active,
// how many of those the site would actually show, and how many have closed.
// "Active but never visible" is dead weight: stored and checked for nothing.
func (r *JobRepository) SourceStats() ([]SourceStat, error) {
	rows, err := r.db.Query(`
		SELECT source, company,
			count(*) FILTER (WHERE status = 'ACTIVE'),
			count(*) FILTER (WHERE status = 'ACTIVE' AND entry_type IN ('NEW_GRAD_COHORT', 'ENTRY_LEVEL_OPEN', 'INTERN')),
			count(*) FILTER (WHERE status = 'CLOSED'),
			max(scraped_at)
		FROM jobs
		GROUP BY source, company
		ORDER BY 4 DESC, 3 DESC, company
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query source stats: %w", err)
	}
	defer rows.Close()

	var out []SourceStat
	for rows.Next() {
		var s SourceStat
		if err := rows.Scan(&s.Source, &s.Company, &s.Active, &s.Visible, &s.Closed, &s.LastSeen); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ActiveJobRow is the slice of an ACTIVE posting needed to re-derive its
// classification.
type ActiveJobRow struct {
	ID           string
	Title        string
	Source       string
	RoleCategory string
}

// ActiveJobRows returns every ACTIVE posting's id, title, source and role
// category.
func (r *JobRepository) ActiveJobRows() ([]ActiveJobRow, error) {
	rows, err := r.db.Query(`SELECT id, title, source, role_category FROM jobs WHERE status = 'ACTIVE'`)
	if err != nil {
		return nil, fmt.Errorf("failed to query active jobs: %w", err)
	}
	defer rows.Close()

	var out []ActiveJobRow
	for rows.Next() {
		var j ActiveJobRow
		if err := rows.Scan(&j.ID, &j.Title, &j.Source, &j.RoleCategory); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

// SetRoleCategory sets the role category of the given jobs.
func (r *JobRepository) SetRoleCategory(category string, ids []string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result, err := r.db.Exec(`
		UPDATE jobs SET role_category = $1, updated_at = $2
		WHERE id = ANY($3::uuid[])
	`, category, time.Now(), pq.Array(ids))
	if err != nil {
		return 0, fmt.Errorf("failed to set role category: %w", err)
	}
	return result.RowsAffected()
}
