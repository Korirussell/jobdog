-- Profile visibility: defaults all resume scores/ranks to PRIVATE
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(16) NOT NULL DEFAULT 'PRIVATE';

-- Saved jobs table
CREATE TABLE saved_jobs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    saved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_saved_jobs_user_job UNIQUE (user_id, job_id)
);
CREATE INDEX idx_saved_jobs_user_saved_at ON saved_jobs(user_id, saved_at DESC);

-- Ghost reports table (user-submitted ghost reports per company)
CREATE TABLE ghost_reports (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    company VARCHAR(255) NOT NULL,
    job_id UUID REFERENCES jobs(id),
    reported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_ghost_reports_user_job UNIQUE (user_id, job_id)
);
CREATE INDEX idx_ghost_reports_company ON ghost_reports(LOWER(company));

-- Resume roast history
CREATE TABLE roast_history (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    resume_id UUID NOT NULL REFERENCES resumes(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    brutal_roast_text TEXT NOT NULL,
    missing_dependencies JSONB NOT NULL DEFAULT '[]',
    top_dog_rank INTEGER NOT NULL,
    tier_name VARCHAR(64) NOT NULL,
    roasted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_roast_history_user ON roast_history(user_id, roasted_at DESC);

-- Expand application status for Task Manager feature
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
