ALTER TABLE roast_history
    ADD COLUMN content_hash VARCHAR(64);

CREATE INDEX idx_roast_history_content_hash ON roast_history (content_hash);
