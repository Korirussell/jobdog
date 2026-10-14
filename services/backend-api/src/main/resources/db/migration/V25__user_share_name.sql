-- Name shown on the public share link; falls back to display_name when empty.
ALTER TABLE users ADD COLUMN share_name VARCHAR(40);
