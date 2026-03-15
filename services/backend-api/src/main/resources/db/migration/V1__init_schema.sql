CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE resumes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    label VARCHAR(120),
    storage_key VARCHAR(512) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_user_uploaded_at ON resumes(user_id, uploaded_at DESC);

CREATE TABLE resume_profiles (
    id UUID PRIMARY KEY,
    resume_id UUID NOT NULL UNIQUE REFERENCES resumes(id),
    skills JSONB NOT NULL,
    years_experience INTEGER,
    education_level VARCHAR(64),
    raw_text_checksum VARCHAR(64),
    parser_provider VARCHAR(64),
    parser_model VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_resume_profiles_skills ON resume_profiles USING GIN (skills);

CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    source VARCHAR(64) NOT NULL,
    source_job_id VARCHAR(255),
    source_url TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    employment_type VARCHAR(64),
    description_text TEXT NOT NULL,
    description_hash VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    minimum_years_experience INTEGER,
    education_level VARCHAR(64),
    posted_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX uq_jobs_source_source_job_id ON jobs(source, source_job_id) WHERE source_job_id IS NOT NULL;
CREATE UNIQUE INDEX uq_jobs_source_url ON jobs(source_url);
CREATE INDEX idx_jobs_description_hash ON jobs(description_hash);
CREATE INDEX idx_jobs_status_posted_at ON jobs(status, posted_at DESC);

CREATE TABLE job_requirement_profiles (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL UNIQUE REFERENCES jobs(id),
    required_skills JSONB NOT NULL,
    preferred_skills JSONB NOT NULL,
    extraction_method VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_job_requirement_required_skills ON job_requirement_profiles USING GIN (required_skills);
CREATE INDEX idx_job_requirement_preferred_skills ON job_requirement_profiles USING GIN (preferred_skills);

CREATE TABLE applications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    resume_id UUID NOT NULL REFERENCES resumes(id),
    status VARCHAR(32) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_applications_user_job UNIQUE (user_id, job_id)
);
CREATE INDEX idx_applications_job_applied_at ON applications(job_id, applied_at DESC);
CREATE INDEX idx_applications_user_applied_at ON applications(user_id, applied_at DESC);

CREATE TABLE application_scores (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL UNIQUE REFERENCES applications(id),
    match_score INTEGER NOT NULL,
    match_breakdown JSONB NOT NULL,
    benchmark_state VARCHAR(32) NOT NULL,
    percentile INTEGER,
    applicant_count INTEGER NOT NULL,
    scored_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_application_scores_state_scored_at ON application_scores(benchmark_state, scored_at DESC);
