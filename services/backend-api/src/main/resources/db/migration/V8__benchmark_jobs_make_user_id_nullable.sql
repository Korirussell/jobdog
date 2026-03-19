-- Existing DBs may already have a user_id column on benchmark_jobs marked NOT NULL.
-- Our BenchmarkJobEntity does not map user ownership, and seeding does not insert user_id,
-- so we must allow NULLs to keep backend booting.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_jobs'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE benchmark_jobs
      ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

