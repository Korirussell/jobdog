-- Deep resume analysis results (persistent, cached per resume)
CREATE TABLE resume_analyses (
    id UUID PRIMARY KEY,
    resume_id UUID NOT NULL REFERENCES resumes(id),
    user_level VARCHAR(16) NOT NULL,
    target_role VARCHAR(120),
    overall_score INTEGER NOT NULL,
    ats_score INTEGER NOT NULL,
    ats_issues JSONB NOT NULL DEFAULT '[]',
    section_scores JSONB NOT NULL DEFAULT '{}',
    bullet_feedback JSONB NOT NULL DEFAULT '[]',
    strengths JSONB NOT NULL DEFAULT '[]',
    improvements JSONB NOT NULL DEFAULT '[]',
    summary_verdict TEXT NOT NULL,
    analyzed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_resume_analyses_resume ON resume_analyses(resume_id, analyzed_at DESC);

-- Job fit results (cached per resume+job pair)
CREATE TABLE resume_job_fits (
    id UUID PRIMARY KEY,
    resume_id UUID NOT NULL REFERENCES resumes(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    fit_score INTEGER NOT NULL,
    matched_skills JSONB NOT NULL DEFAULT '[]',
    missing_skills JSONB NOT NULL DEFAULT '[]',
    fit_summary TEXT NOT NULL,
    analyzed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_resume_job_fit UNIQUE (resume_id, job_id)
);
CREATE INDEX idx_resume_job_fits_resume ON resume_job_fits(resume_id, analyzed_at DESC);
