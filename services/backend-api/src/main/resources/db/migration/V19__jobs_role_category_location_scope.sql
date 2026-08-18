-- Role-function and geographic-eligibility classification.
--
-- The board was drowning new-grad SWE searches in quant/trading, hardware,
-- product, and sales reqs pulled in by the same aggregators and ATS boards,
-- plus non-US-only postings a US candidate can't take. Both are computed
-- deterministically from title/location at scrape time (see
-- scraper.ClassifyRoleCategory / scraper.ClassifyLocationScope) and default to
-- the inclusive value (SOFTWARE / US_OR_REMOTE) whenever nothing rules it out,
-- so unclassified rows never disappear — this is a query-time filter, not an
-- ingest-time drop.
ALTER TABLE jobs
    ADD COLUMN role_category   VARCHAR(24) NOT NULL DEFAULT 'SOFTWARE',
    ADD COLUMN location_scope  VARCHAR(16) NOT NULL DEFAULT 'US_OR_REMOTE';

CREATE INDEX idx_jobs_role_category_location_scope ON jobs (role_category, location_scope)
    WHERE status = 'ACTIVE';
