-- Extend resume analysis payload to support ATS parse view + recruiter take.
-- Required because spring.jpa.hibernate.ddl-auto=validate

ALTER TABLE resume_analyses
  ADD COLUMN IF NOT EXISTS ats_parsed_sections jsonb,
  ADD COLUMN IF NOT EXISTS recruiter_take jsonb;

