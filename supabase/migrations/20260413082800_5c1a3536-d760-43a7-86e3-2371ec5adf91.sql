-- Add new post type enum values (forward-only)
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'comparison';
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'question';
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'tip';
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'update';

-- Set DB-level default for post_type
ALTER TABLE posts ALTER COLUMN post_type SET DEFAULT 'story';

-- Backfill any NULL post_type values
UPDATE posts SET post_type = 'story' WHERE post_type IS NULL;