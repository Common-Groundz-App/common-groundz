-- ============================================
-- Phase 3: Email Verification RLS Enforcement
-- ============================================
-- Wrapped in transaction: if ANY step fails, ALL changes rollback
-- ============================================

BEGIN;

-- Step 1: Create the verification check function
CREATE OR REPLACE FUNCTION public.is_email_verified(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT email_confirmed_at IS NOT NULL 
     FROM auth.users 
     WHERE id = check_user_id),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_email_verified(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_email_verified IS 
'Phase 3: Checks if user email is verified. Used in RLS INSERT policies.';

-- Step 2: Update posts INSERT policy
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can insert their own posts" ON posts IS 
'Phase 3: Requires email verification to create posts';

-- Step 3: Update post_comments INSERT policy
DROP POLICY IF EXISTS "Authenticated users can add post comments" ON post_comments;
CREATE POLICY "Authenticated users can add post comments" ON post_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Authenticated users can add post comments" ON post_comments IS 
'Phase 3: Requires email verification to comment on posts';

-- Step 4: Update post_likes INSERT policy
DROP POLICY IF EXISTS "Users can create their own likes" ON post_likes;
CREATE POLICY "Users can create their own likes" ON post_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can create their own likes" ON post_likes IS 
'Phase 3: Requires email verification to like posts';

-- Step 5: Update recommendation_comments INSERT policy
DROP POLICY IF EXISTS "Authenticated users can add comments" ON recommendation_comments;
CREATE POLICY "Authenticated users can add comments" ON recommendation_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Authenticated users can add comments" ON recommendation_comments IS 
'Phase 3: Requires email verification to comment on recommendations';

-- Step 6: Update recommendation_likes INSERT policy
DROP POLICY IF EXISTS "Users can insert their own likes" ON recommendation_likes;
CREATE POLICY "Users can insert their own likes" ON recommendation_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can insert their own likes" ON recommendation_likes IS 
'Phase 3: Requires email verification to like recommendations';

-- Step 7: Update follows INSERT policy
DROP POLICY IF EXISTS "Users can create follows" ON follows;
CREATE POLICY "Users can create follows" ON follows
  FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can create follows" ON follows IS 
'Phase 3: Requires email verification to follow users';

-- Step 8: Update recommendations INSERT policy
DROP POLICY IF EXISTS "Users can insert their own recommendations" ON recommendations;
CREATE POLICY "Users can insert their own recommendations" ON recommendations
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_email_verified(auth.uid())
  );
COMMENT ON POLICY "Users can insert their own recommendations" ON recommendations IS 
'Phase 3: Requires email verification to create recommendations';

COMMIT;