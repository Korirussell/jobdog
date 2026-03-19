-- benchmark_jobs.category was added in BenchmarkJobEntity but the column may be missing in existing DBs.
-- ddl-auto=validate requires the column to exist (and match nullability enough for Hibernate validation).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'benchmark_jobs'
  ) THEN
    -- Add missing required columns for Hibernate schema validation.
    -- Use defaults so NOT NULL additions won't fail on existing rows.
    ALTER TABLE benchmark_jobs ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT '';
    ALTER TABLE benchmark_jobs ADD COLUMN IF NOT EXISTS company VARCHAR(255) NOT NULL DEFAULT '';
    ALTER TABLE benchmark_jobs ADD COLUMN IF NOT EXISTS category VARCHAR(64) NOT NULL DEFAULT 'STARTUP';
    ALTER TABLE benchmark_jobs ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE benchmark_jobs ADD COLUMN IF NOT EXISTS difficulty_level INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

