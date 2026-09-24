-- Add last_viewed_at to knowledge_items for genuine "Continue Reading" tracking
ALTER TABLE knowledge_items ADD COLUMN last_viewed_at DATETIME;
