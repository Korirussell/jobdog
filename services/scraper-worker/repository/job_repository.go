package repository

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"jobdog/scraper-worker/database"
	"jobdog/scraper-worker/models"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/rs/zerolog/log"
)

type JobRepository struct {
	db *database.DB
}

func NewJobRepository(db *database.DB) *JobRepository {
	return &JobRepository{db: db}
}

// UpsertJob writes a scraped posting and reports whether the description text
// passed in became (or stayed) the row's authoritative one.
//
// The same posting is often scraped from more than one place — a community
// aggregator repo covers it with a synthesized one-line stub ("Role at
// Company - Location"), while polling the company's own Greenhouse/Lever/
// Ashby/Workday board directly pulls the real posting body. Both paths write
// to the same source_url once it's canonicalized, and they run concurrently
// with no ordering guarantee, so an unconditional overwrite meant whichever
// scraper happened to finish last could silently replace a rich description
// with a thin one — degrading every downstream classification (experience
// level, grad-year cohort, skills) that was correctly derived from the richer
// text on an earlier cycle. Never regressing to a shorter description fixes
// that regardless of scrape order.
//
// descriptionAccepted tells the caller whether it's safe to (re)run
// classification against job.DescriptionText: false means a richer
// description already on file won this round, so reclassifying now would
// overwrite a good verdict with one derived from worse data.
func (r *JobRepository) UpsertJob(job *models.Job) (id string, descriptionAccepted bool, err error) {
	if job.ID == "" {
		job.ID = uuid.New().String()
	}

	job.DescriptionHash = hashDescription(job.DescriptionText)
	job.ScrapedAt = time.Now()

	// Every scraper sets these before calling UpsertJob, but default to the
	// inclusive value here too so a call site that forgets doesn't silently
	// insert an empty string a query-time filter would then treat as "exclude"
	// rather than "unclassified".
	if job.RoleCategory == "" {
		job.RoleCategory = "SOFTWARE"
	}
	if job.LocationScope == "" {
		job.LocationScope = "US_OR_REMOTE"
	}

	query := `
		INSERT INTO jobs (
			id, source, source_job_id, source_url, title, company, location,
			employment_type, description_text, description_hash, status,
			minimum_years_experience, education_level, experience_level, role_category, location_scope,
			salary_raw, posted_at, scraped_at,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20)
		ON CONFLICT (source_url)
		DO UPDATE SET
			title = EXCLUDED.title,
			company = EXCLUDED.company,
			location = EXCLUDED.location,
			employment_type = EXCLUDED.employment_type,
			-- Never let a thinner description (and the classification derived from
			-- it) replace a richer one just because this scrape happened to run
			-- last. Equal-length keeps taking the fresh copy so a genuinely
			-- unchanged repost still refreshes normally.
			description_text = CASE
				WHEN length(EXCLUDED.description_text) >= length(jobs.description_text) THEN EXCLUDED.description_text
				ELSE jobs.description_text
			END,
			description_hash = CASE
				WHEN length(EXCLUDED.description_text) >= length(jobs.description_text) THEN EXCLUDED.description_hash
				ELSE jobs.description_hash
			END,
			status = 'ACTIVE',
			experience_level = CASE
				WHEN length(EXCLUDED.description_text) >= length(jobs.description_text) THEN EXCLUDED.experience_level
				ELSE jobs.experience_level
			END,
			-- Title-derived, so always safe to refresh regardless of which
			-- description won this round.
			role_category = EXCLUDED.role_category,
			location_scope = EXCLUDED.location_scope,
			-- Keep a previously captured salary if the board stops publishing it,
			-- rather than nulling out data we already have.
			salary_raw = COALESCE(EXCLUDED.salary_raw, jobs.salary_raw),
			posted_at = COALESCE(jobs.posted_at, EXCLUDED.posted_at),
			scraped_at = EXCLUDED.scraped_at,
			updated_at = EXCLUDED.updated_at
		RETURNING id, description_text = $9
	`

	err = r.db.QueryRow(
		query,
		job.ID, job.Source, job.SourceJobID, job.SourceURL, job.Title, job.Company,
		job.Location, job.EmploymentType, job.DescriptionText, job.DescriptionHash,
		job.Status, job.MinimumYearsExperience, job.EducationLevel, job.ExperienceLevel,
		job.RoleCategory, job.LocationScope,
		job.SalaryRaw, job.PostedAt, job.ScrapedAt, time.Now(),
	).Scan(&id, &descriptionAccepted)

	if err != nil {
		return "", false, fmt.Errorf("failed to upsert job: %w", err)
	}

	// Record what this posting looked like on this cycle. Snapshot failures are
	// logged but never fail the upsert: the serving path must keep working even if
	// the analytics history falls behind.
	if err := r.recordSnapshot(id, job); err != nil {
		log.Warn().Err(err).Str("job_id", id).Msg("Failed to record job snapshot")
	}

	return id, descriptionAccepted, nil
}

// recordSnapshot appends the posting's current state to the append-only history
// that feeds the trend layer. History cannot be reconstructed after the fact —
// once a scrape overwrites `jobs`, the previous state is gone — so this is
// written on every cycle rather than only on change.
func (r *JobRepository) recordSnapshot(jobID string, job *models.Job) error {
	_, err := r.db.Exec(`
		INSERT INTO job_snapshots (job_id, observed_at, status, description_hash, experience_level, salary_raw)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, jobID, job.ScrapedAt, job.Status, job.DescriptionHash, job.ExperienceLevel, job.SalaryRaw)
	return err
}

func (r *JobRepository) UpsertJobRequirementProfile(profile *models.JobRequirementProfile) error {
	requiredSkills := profile.RequiredSkills
	if requiredSkills == nil {
		requiredSkills = []string{}
	}

	preferredSkills := profile.PreferredSkills
	if preferredSkills == nil {
		preferredSkills = []string{}
	}

	query := `
		INSERT INTO job_requirement_profiles (
			id, job_id, required_skills, preferred_skills, extraction_method,
			created_at, updated_at
		) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $6)
		ON CONFLICT (job_id)
		DO UPDATE SET
			required_skills = EXCLUDED.required_skills,
			preferred_skills = EXCLUDED.preferred_skills,
			extraction_method = EXCLUDED.extraction_method,
			updated_at = EXCLUDED.updated_at
	`

	requiredJSON, err := jsonMarshal(requiredSkills)
	if err != nil {
		return fmt.Errorf("failed to marshal required skills: %w", err)
	}

	preferredJSON, err := jsonMarshal(preferredSkills)
	if err != nil {
		return fmt.Errorf("failed to marshal preferred skills: %w", err)
	}

	_, err = r.db.Exec(
		query,
		uuid.New().String(),
		profile.JobID,
		requiredJSON,
		preferredJSON,
		profile.ExtractionMethod,
		time.Now(),
	)

	if err != nil {
		return fmt.Errorf("failed to upsert job requirement profile: %w", err)
	}

	return nil
}

func (r *JobRepository) MarkStaleJobsAsClosed(olderThan time.Duration) error {
	query := `
		UPDATE jobs
		SET status = 'CLOSED', updated_at = $1
		WHERE status = 'ACTIVE'
		AND scraped_at < $2
	`

	cutoff := time.Now().Add(-olderThan)
	_, err := r.db.Exec(query, time.Now(), cutoff)
	if err != nil {
		return fmt.Errorf("failed to mark stale jobs as closed: %w", err)
	}

	return nil
}

// PurgeOldClosedJobs hard-deletes CLOSED jobs whose scraped_at is older than the
// cutoff, to keep the jobs table from growing forever. It never deletes a job that
// a user has real history tied to (an application, or a saved-jobs bookmark) —
// those are excluded from the candidate set entirely, regardless of age. For the
// remaining candidates, purely-derived/computed child rows (job requirement
// profiles, roast history, resume-job fit results, ghost reports) are cascaded
// away first since they have no independent value once the job itself is gone,
// then the jobs themselves are deleted. Everything runs in a single transaction so
// a job is never deleted with orphaned children, or vice versa. Returns the count
// of jobs actually deleted (not child rows).
func (r *JobRepository) PurgeOldClosedJobs(olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)

	tx, err := r.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("beginning purge transaction: %w", err)
	}
	defer tx.Rollback()

	rows, err := tx.Query(`
		SELECT id FROM jobs
		WHERE status = 'CLOSED' AND scraped_at < $1
		AND id NOT IN (SELECT DISTINCT job_id FROM applications)
		AND id NOT IN (SELECT DISTINCT job_id FROM saved_jobs)
	`, cutoff)
	if err != nil {
		return 0, fmt.Errorf("selecting purge candidates: %w", err)
	}

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return 0, fmt.Errorf("scanning purge candidate id: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return 0, fmt.Errorf("iterating purge candidate rows: %w", err)
	}
	rows.Close()

	if len(ids) == 0 {
		return 0, tx.Commit()
	}

	idArray := pq.Array(ids)

	if _, err := tx.Exec(`DELETE FROM job_requirement_profiles WHERE job_id = ANY($1)`, idArray); err != nil {
		return 0, fmt.Errorf("purging job_requirement_profiles for candidate jobs: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM roast_history WHERE job_id = ANY($1)`, idArray); err != nil {
		return 0, fmt.Errorf("purging roast_history for candidate jobs: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM resume_job_fits WHERE job_id = ANY($1)`, idArray); err != nil {
		return 0, fmt.Errorf("purging resume_job_fits for candidate jobs: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM ghost_reports WHERE job_id = ANY($1)`, idArray); err != nil {
		return 0, fmt.Errorf("purging ghost_reports for candidate jobs: %w", err)
	}

	result, err := tx.Exec(`DELETE FROM jobs WHERE id = ANY($1)`, idArray)
	if err != nil {
		return 0, fmt.Errorf("purging old closed jobs: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("getting purge rows affected: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("committing purge transaction: %w", err)
	}

	return rowsAffected, nil
}

type ActiveJob struct {
	ID        string
	SourceURL string
}

func (r *JobRepository) GetActiveJobURLs() ([]ActiveJob, error) {
	query := `SELECT id, source_url FROM jobs WHERE status = 'ACTIVE'`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active job URLs: %w", err)
	}
	defer rows.Close()

	var jobs []ActiveJob
	for rows.Next() {
		var j ActiveJob
		if err := rows.Scan(&j.ID, &j.SourceURL); err != nil {
			return nil, fmt.Errorf("failed to scan active job row: %w", err)
		}
		jobs = append(jobs, j)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating active job rows: %w", err)
	}

	return jobs, nil
}

func (r *JobRepository) MarkJobInactive(id string) error {
	query := `UPDATE jobs SET status = 'CLOSED', updated_at = $1 WHERE id = $2`

	_, err := r.db.Exec(query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to mark job inactive: %w", err)
	}

	return nil
}

func hashDescription(text string) string {
	hash := sha256.Sum256([]byte(text))
	return hex.EncodeToString(hash[:])
}

func jsonMarshal(v interface{}) (string, error) {
	bytes, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// LookupGradClassification returns a cached model verdict for a description
// hash. The cache is the reason the model pass is affordable: the scraper runs
// every 2 hours, so an uncached classifier would re-answer the same question
// about the same corpus twelve times a day.
func (r *JobRepository) LookupGradClassification(descriptionHash, model string) (*models.GradClassification, error) {
	if descriptionHash == "" {
		return nil, nil
	}

	row := r.db.QueryRow(`
		SELECT entry_type, grad_year_min, grad_year_max, confidence, evidence
		FROM grad_classifications
		WHERE description_hash = $1 AND model = $2
	`, descriptionHash, model)

	var (
		result           models.GradClassification
		yearMin, yearMax sql.NullInt16
		confidence       sql.NullFloat64
		evidence         sql.NullString
	)
	if err := row.Scan(&result.EntryType, &yearMin, &yearMax, &confidence, &evidence); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	result.YearMin = int(yearMin.Int16)
	result.YearMax = int(yearMax.Int16)
	result.Confidence = confidence.Float64
	result.Evidence = evidence.String
	return &result, nil
}

// SaveGradClassification caches a model verdict. Re-classifying the same content
// overwrites, so a prompt change followed by a targeted re-run converges rather
// than accumulating stale rows.
func (r *JobRepository) SaveGradClassification(descriptionHash, model string, c models.GradClassification) error {
	if descriptionHash == "" {
		return nil
	}

	_, err := r.db.Exec(`
		INSERT INTO grad_classifications
			(description_hash, entry_type, grad_year_min, grad_year_max, confidence, evidence, model, classified_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (description_hash) DO UPDATE SET
			entry_type    = EXCLUDED.entry_type,
			grad_year_min = EXCLUDED.grad_year_min,
			grad_year_max = EXCLUDED.grad_year_max,
			confidence    = EXCLUDED.confidence,
			evidence      = EXCLUDED.evidence,
			model         = EXCLUDED.model,
			classified_at = NOW()
	`, descriptionHash, c.EntryType, nullableYear(c.YearMin), nullableYear(c.YearMax), c.Confidence, c.Evidence, model)
	return err
}

// UpdateJobGradCohort writes the resolved cohort onto the job row.
func (r *JobRepository) UpdateJobGradCohort(jobID string, c models.GradClassification) error {
	_, err := r.db.Exec(`
		UPDATE jobs SET
			entry_type      = $2,
			grad_year_min   = $3,
			grad_year_max   = $4,
			grad_source     = $5,
			grad_confidence = $6,
			grad_evidence   = $7,
			updated_at      = NOW()
		WHERE id = $1
	`, jobID, c.EntryType, nullableYear(c.YearMin), nullableYear(c.YearMax), c.Source, c.Confidence, c.Evidence)
	return err
}

// nullableYear maps the zero value used for "no year known" onto SQL NULL, so
// the column never claims a posting targets the year 0.
func nullableYear(year int) any {
	if year == 0 {
		return nil
	}
	return year
}
