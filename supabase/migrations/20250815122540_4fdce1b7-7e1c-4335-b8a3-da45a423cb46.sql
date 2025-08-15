-- Add composite index for hashtag posts performance
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag_created 
ON post_hashtags (hashtag_id, created_at DESC);

-- Add index for faster hashtag lookups by normalized name
CREATE INDEX IF NOT EXISTS idx_hashtags_name_norm 
ON hashtags (name_norm);