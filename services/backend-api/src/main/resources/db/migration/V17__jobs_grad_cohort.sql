-- Graduation-cohort classification.
--
-- experience_level (V14) collapses two very different things into "NEW_GRAD": a
-- role gated on a graduation window ("class of 2027") and an ordinary junior req
-- anyone can apply to. Those are the postings users complain about finding in
-- new-grad lists, so they get distinct entry types here, plus the actual
-- eligibility window when the posting states one.
ALTER TABLE jobs
    ADD COLUMN entry_type       VARCHAR(24),
    ADD COLUMN grad_year_min    SMALLINT,
    ADD COLUMN grad_year_max    SMALLINT,
    -- REGEX, LLM, or NONE — lets us audit how a verdict was reached and re-run
    -- just the model-derived ones if the prompt changes.
    ADD COLUMN grad_source      VARCHAR(8),
    ADD COLUMN grad_confidence  REAL,
    ADD COLUMN grad_evidence    TEXT;

-- The primary browse query: active cohort-gated roles for a given class year.
CREATE INDEX idx_jobs_entry_type_grad_years ON jobs (entry_type, grad_year_min, grad_year_max)
    WHERE status = 'ACTIVE';

-- Cached model verdicts, keyed by the hash of the description they were derived
-- from.
--
-- This is what makes the model pass affordable. The scraper runs every 2 hours,
-- so without a cache the entire active corpus would be re-classified twelve
-- times a day — the same postings, the same answers, billed every time. Keyed on
-- content rather than job id, a verdict is also reused across companies that
-- publish an identical description, and is correctly invalidated when a company
-- edits a posting.
CREATE TABLE grad_classifications (
    description_hash VARCHAR(64) PRIMARY KEY,
    entry_type       VARCHAR(24) NOT NULL,
    grad_year_min    SMALLINT,
    grad_year_max    SMALLINT,
    confidence       REAL,
    evidence         TEXT,
    -- Which model produced this, so a model change can invalidate selectively
    -- instead of dropping the whole cache.
    model            VARCHAR(64) NOT NULL,
    classified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grad_classifications_model ON grad_classifications (model);
