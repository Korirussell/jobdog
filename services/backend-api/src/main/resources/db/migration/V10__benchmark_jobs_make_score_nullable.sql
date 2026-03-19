-- Seed inserts benchmark_jobs without score/user/job ownership.
-- Existing DBs may have NOT NULL constraints on score; drop them to keep app booting.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_jobs'
      AND column_name = 'score'
  ) THEN
    ALTER TABLE benchmark_jobs
      ALTER COLUMN score DROP NOT NULL;
  END IF;
END $$;

