-- Phase 3.3B: represent the follows unique identity in repo migrations.
-- The live database already has follows_follower_id_following_id_key; this is a
-- no-op there, but guarantees a database built from migrations enforces the same
-- (follower_id, following_id) uniqueness that Follow-back's insert-ignore relies on.
CREATE UNIQUE INDEX IF NOT EXISTS follows_follower_id_following_id_key
  ON public.follows (follower_id, following_id);