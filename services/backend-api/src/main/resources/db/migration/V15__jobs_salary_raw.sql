-- Compensation as published by the source board.
--
-- Stored as free text rather than a numeric range because that is what the ATS
-- APIs actually return: Ashby renders strings like "$207K – $259K + Token
-- Compensation", and the shape varies by board. Parsing into a structured range
-- is a separate concern that can be done later from this raw value; capturing it
-- cannot be, because a posting's compensation is gone once the posting closes.
ALTER TABLE jobs
    ADD COLUMN salary_raw TEXT;

-- Supports "has published compensation" filtering without scanning the table.
CREATE INDEX idx_jobs_salary_raw_present ON jobs ((salary_raw IS NOT NULL))
    WHERE status = 'ACTIVE';
