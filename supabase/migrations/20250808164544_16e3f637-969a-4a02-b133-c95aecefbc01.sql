-- Create table for user mentions in posts
CREATE TABLE IF NOT EXISTS public.post_user_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  mentioned_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, mentioned_user_id)
);

-- Enable RLS
ALTER TABLE public.post_user_mentions ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_post_user_mentions_post_id ON public.post_user_mentions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_user_mentions_mentioned_user_id ON public.post_user_mentions(mentioned_user_id);

-- Policies
-- Anyone can view mentions for public posts (and not deleted)
CREATE POLICY IF NOT EXISTS "View mentions on public posts"
ON public.post_user_mentions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_user_mentions.post_id
      AND p.visibility = 'public'
      AND p.is_deleted = false
  )
);

-- Users can view mentions for circle_only posts they have access to (owner or follower)
CREATE POLICY IF NOT EXISTS "View mentions on circle posts with access"
ON public.post_user_mentions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_user_mentions.post_id
      AND p.visibility = 'circle_only'
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid()
            AND f.following_id = p.user_id
        )
      )
  )
);

-- Users can view mentions for their own private posts
CREATE POLICY IF NOT EXISTS "View mentions on own private posts"
ON public.post_user_mentions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_user_mentions.post_id
      AND p.visibility = 'private'
      AND p.user_id = auth.uid()
  )
);

-- Users can insert mentions for their own posts
CREATE POLICY IF NOT EXISTS "Insert mentions for own posts"
ON public.post_user_mentions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_user_mentions.post_id
      AND p.user_id = auth.uid()
  )
);

-- Users can delete mentions for their own posts
CREATE POLICY IF NOT EXISTS "Delete mentions for own posts"
ON public.post_user_mentions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_user_mentions.post_id
      AND p.user_id = auth.uid()
  )
);
