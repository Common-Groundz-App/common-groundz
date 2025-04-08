
-- Drop the comments table and related functionality
DROP TABLE IF EXISTS public.comments;

-- Remove comment_count column from posts
ALTER TABLE posts DROP COLUMN IF EXISTS comment_count;

-- Remove comment_count column from recommendations
ALTER TABLE recommendations DROP COLUMN IF EXISTS comment_count;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_post_comment_count();
DROP FUNCTION IF EXISTS public.update_recommendation_comment_count();
DROP FUNCTION IF EXISTS public.get_comment_reply_count(uuid);

-- Create a empty comment_count column for posts to maintain API compatibility
ALTER TABLE posts ADD COLUMN comment_count integer NOT NULL DEFAULT 0;

-- Create a empty comment_count column for recommendations to maintain API compatibility
ALTER TABLE recommendations ADD COLUMN comment_count integer NOT NULL DEFAULT 0;
