-- Performance indexes for job queries
-- These indexes optimize LIKE queries and full-text search

-- Status index for WHERE status = 'ACTIVE' queries
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Posted date index for ORDER BY posted_at DESC
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at_desc ON jobs(posted_at DESC NULLS LAST);

-- Lowercase indexes for case-insensitive LIKE queries
CREATE INDEX IF NOT EXISTS idx_jobs_company_lower ON jobs(LOWER(company));
CREATE INDEX IF NOT EXISTS idx_jobs_location_lower ON jobs(LOWER(location));
CREATE INDEX IF NOT EXISTS idx_jobs_title_lower ON jobs(LOWER(title));

-- Full-text search index for description using PostgreSQL GIN
CREATE INDEX IF NOT EXISTS idx_jobs_description_text_gin 
ON jobs USING gin(to_tsvector('english', description_text));

-- Composite index for common query pattern (status + posted_at)
-- Note: V1 already has idx_jobs_status_posted_at, but this ensures DESC NULLS LAST
CREATE INDEX IF NOT EXISTS idx_jobs_status_posted_at_optimized 
ON jobs(status, posted_at DESC NULLS LAST);
