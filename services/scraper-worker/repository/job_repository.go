package repository

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"jobdog/scraper-worker/database"
	"jobdog/scraper-worker/models"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type JobRepository struct {
	db *database.DB
}

func NewJobRepository(db *database.DB) *JobRepository {
	return &JobRepository{db: db}
}

func (r *JobRepository) UpsertJob(job *models.Job) (string, error) {
	if job.ID == "" {
		job.ID = uuid.New().String()
	}

	job.DescriptionHash = hashDescription(job.DescriptionText)
	job.ScrapedAt = time.Now()

	query := `
		INSERT INTO jobs (
			id, source, source_job_id, source_url, title, company, location,
			employment_type, description_text, description_hash, status,
			minimum_years_experience, education_level, experience_level, posted_at, scraped_at,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
		ON CONFLICT (source_url)
		DO UPDATE SET
			title = EXCLUDED.title,
			company = EXCLUDED.company,
			location = EXCLUDED.location,
			employment_type = EXCLUDED.employment_type,
			description_text = EXCLUDED.description_text,
			description_hash = EXCLUDED.description_hash,
			status = 'ACTIVE',
			experience_level = EXCLUDED.experience_level,
			posted_at = COALESCE(jobs.posted_at, EXCLUDED.posted_at),
			scraped_at = EXCLUDED.scraped_at,
			updated_at = EXCLUDED.updated_at
		RETURNING id
	`

	var id string
	err := r.db.QueryRow(
		query,
		job.ID, job.Source, job.SourceJobID, job.SourceURL, job.Title, job.Company,
		job.Location, job.EmploymentType, job.DescriptionText, job.DescriptionHash,
		job.Status, job.MinimumYearsExperience, job.EducationLevel, job.ExperienceLevel, job.PostedAt,
		job.ScrapedAt, time.Now(),
	).Scan(&id)

	if err != nil {
		return "", fmt.Errorf("failed to upsert job: %w", err)
	}

	return id, nil
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
