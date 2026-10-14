-- Opt-in: show the resume PDF and ATS view on the public share link.
ALTER TABLE users ADD COLUMN share_resume BOOLEAN NOT NULL DEFAULT FALSE;
