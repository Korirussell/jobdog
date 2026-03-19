-- Existing DBs may already have a job_id column on benchmark_jobs marked NOT NULL.
-- BenchmarkJobEntity does not map user/job ownership and seed inserts omit these fields.
-- To keep backend booting, allow benchmark_jobs.job_id to be NULL.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_jobs'
      AND column_name = 'job_id'
  ) THEN
    ALTER TABLE benchmark_jobs
      ALTER COLUMN job_id DROP NOT NULL;
  END IF;
END $$;

