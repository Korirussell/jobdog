-- Listing feedback, resume-upload credits, and user activity tracking.

-- Resume uploads cost real money (PDF parsing and analysis call an LLM), so
-- they are metered: everyone starts with 3, and confirming whether job links
-- work earns more (see JobReportService). report_credit_progress counts
-- confirmations toward the next credit.
ALTER TABLE users
    ADD COLUMN resume_credits         INTEGER     NOT NULL DEFAULT 3,
    ADD COLUMN report_credit_progress INTEGER     NOT NULL DEFAULT 0,
    -- Bumped at most every few minutes on authenticated requests, so "who is
    -- actually using the site" is answerable without an analytics vendor.
    ADD COLUMN last_seen_at           TIMESTAMPTZ;

-- Set when a posting is found to be dead (the liveness checker, or enough user
-- reports). Scrapes will not reopen a posting for 14 days after this: an
-- aggregator list keeps linking to a dead job for as long as nobody edits the
-- README, so without it the job flapped open and closed every cycle.
ALTER TABLE jobs ADD COLUMN dead_at TIMESTAMPTZ;

-- One user's verdict on one listing: does its apply link lead to a real job?
-- Fixed verdicts only, no free text, so user input can never carry
-- instructions to whatever reads these later.
CREATE TABLE job_reports (
    id         UUID PRIMARY KEY,
    job_id     UUID        NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    verdict    VARCHAR(8)  NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_job_reports_job_user UNIQUE (job_id, user_id),
    CONSTRAINT ck_job_reports_verdict CHECK (verdict IN ('WORKS', 'DEAD'))
);

CREATE INDEX idx_job_reports_job_verdict ON job_reports (job_id, verdict);
CREATE INDEX idx_job_reports_user_created ON job_reports (user_id, created_at);
