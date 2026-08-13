-- Append-only history of what each posting looked like on each scrape cycle.
--
-- This is the input to the Spark trend layer, and it exists as its own table for
-- one reason: history cannot be backfilled. The `jobs` table holds only current
-- state, so every scrape overwrites what the market looked like an hour ago. Any
-- question of the form "what changed" — which skills are rising in FAANG new-grad
-- postings, how long a requisition stays open, which 2027 requirements did not
-- exist in 2026 — is unanswerable without a record captured at the time.
--
-- Deliberately narrow: description_hash rather than the description itself, so a
-- row stays small enough to write on every cycle for every posting. The hash is
-- enough to detect that a posting changed; `jobs` holds the current text, and the
-- Parquet export to S3 carries description text for the batch layer.
CREATE TABLE job_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    job_id          UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          VARCHAR(16) NOT NULL,
    description_hash VARCHAR(64),
    experience_level VARCHAR(16),
    salary_raw      TEXT
);

-- The dominant read is "history for one posting, oldest first" (lifecycle
-- questions: when did it appear, when did it change, when did it close).
CREATE INDEX idx_job_snapshots_job_observed ON job_snapshots (job_id, observed_at);

-- Supports exporting a time window to Parquet without scanning the whole table,
-- which is how the batch layer will read it.
CREATE INDEX idx_job_snapshots_observed_at ON job_snapshots (observed_at);
