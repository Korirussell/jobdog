ALTER TABLE jobs
    ADD COLUMN experience_level VARCHAR(16);

CREATE INDEX idx_jobs_experience_level ON jobs(experience_level);
