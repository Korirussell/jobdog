-- Allow roasting a resume without a specific job context
ALTER TABLE roast_history ALTER COLUMN job_id DROP NOT NULL;
