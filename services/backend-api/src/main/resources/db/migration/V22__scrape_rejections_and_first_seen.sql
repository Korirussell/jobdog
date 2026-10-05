-- Postings the scrapers' ingest gate has turned down.
--
-- A rejected posting is never stored, so a scraper that has to fetch a posting in
-- full to judge it (Workday: one HTTP request each) would otherwise fetch and
-- reject the same thousand postings again on every cycle. This is what lets a
-- cycle do work proportional to what is new instead of to what exists.
CREATE TABLE scrape_rejections (
    source        VARCHAR(32)  NOT NULL,
    source_job_id VARCHAR(255) NOT NULL,
    reason        VARCHAR(64)  NOT NULL,
    rejected_at   TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (source, source_job_id)
);

CREATE INDEX idx_scrape_rejections_rejected_at ON scrape_rejections (rejected_at);
