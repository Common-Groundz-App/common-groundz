
-- Migration 1: Add parent_id for 1-level threading
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES post_comments(id) ON DELETE SET NULL;
ALTER TABLE recommendation_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES recommendation_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_comments_parent_id ON recommendation_comments(parent_id);

-- Migration 2: Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  comment_type text NOT NULL CHECK (comment_type IN ('post', 'recommendation')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, comment_type, user_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comment likes" ON comment_likes;
CREATE POLICY "Anyone can view comment likes" ON comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Verified users can like comments" ON comment_likes;
CREATE POLICY "Verified users can like comments" ON comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_email_verified(auth.uid()));

DROP POLICY IF EXISTS "Users can unlike their own" ON comment_likes;
CREATE POLICY "Users can unlike their own" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_lookup ON comment_likes(comment_id, comment_type);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);

-- Migration 3: Update RPC functions

-- Updated add_comment with parent_id support
CREATE OR REPLACE FUNCTION public.add_comment(
  p_item_id uuid,
  p_item_type text,
  p_content text,
  p_user_id uuid,
  p_parent_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_table text;
  id_field text;
  parent_table text;
  parent_parent_id uuid;
BEGIN
  -- Validate input
  IF p_item_type NOT IN ('recommendation', 'post') THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  -- Set table names based on item type
  IF p_item_type = 'recommendation' THEN
    comment_table := 'recommendation_comments';
    id_field := 'recommendation_id';
    parent_table := 'recommendations';
  ELSE
    comment_table := 'post_comments';
    id_field := 'post_id';
    parent_table := 'posts';
  END IF;

  -- Validate parent_id if provided (enforce 1-level threading)
  IF p_parent_id IS NOT NULL THEN
    EXECUTE format('
      SELECT parent_id FROM %I WHERE id = $1 AND is_deleted = false
    ', comment_table)
    INTO parent_parent_id
    USING p_parent_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent comment not found or deleted';
    END IF;

    IF parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reply to a reply (max 1 level of nesting)';
    END IF;
  END IF;

  -- Insert the comment with parent_id
  EXECUTE format('
    INSERT INTO %I (%I, user_id, content, parent_id)
    VALUES ($1, $2, $3, $4)
  ', comment_table, id_field)
  USING p_item_id, p_user_id, p_content, p_parent_id;

  -- Update the comment count in parent table
  EXECUTE format('
    UPDATE %I
    SET comment_count = comment_count + 1
    WHERE id = $1
  ', parent_table)
  USING p_item_id;

  RETURN true;
END;
$$;

-- Updated get_comments_with_profiles with threading data
CREATE OR REPLACE FUNCTION public.get_comments_with_profiles(
  p_table_name text,
  p_id_field text,
  p_item_id uuid,
  p_current_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  user_id uuid,
  username text,
  avatar_url text,
  first_name text,
  last_name text,
  edited_at timestamptz,
  parent_id uuid,
  like_count bigint,
  reply_count bigint,
  is_liked boolean,
  is_from_circle boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query text;
  comment_type_val text;
BEGIN
  IF p_table_name NOT IN ('recommendation_comments', 'post_comments') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  IF p_id_field NOT IN ('recommendation_id', 'post_id') THEN
    RAISE EXCEPTION 'Invalid ID field: %', p_id_field;
  END IF;

  -- Determine comment_type for comment_likes lookup
  IF p_table_name = 'post_comments' THEN
    comment_type_val := 'post';
  ELSE
    comment_type_val := 'recommendation';
  END IF;

  query := format('
    SELECT
      c.id,
      c.content,
      c.created_at,
      c.user_id,
      p.username,
      p.avatar_url,
      p.first_name,
      p.last_name,
      CASE WHEN c.updated_at > c.created_at + interval ''1 second'' THEN c.updated_at ELSE NULL END as edited_at,
      c.parent_id,
      COALESCE((SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.comment_type = %L), 0) as like_count,
      COALESCE((SELECT COUNT(*) FROM %I ch WHERE ch.parent_id = c.id AND ch.is_deleted = false), 0) as reply_count,
      CASE WHEN %L IS NOT NULL THEN
        EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.comment_type = %L AND cl.user_id = %L::uuid)
      ELSE false END as is_liked,
      CASE WHEN %L IS NOT NULL THEN
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = %L::uuid AND f.following_id = c.user_id)
      ELSE false END as is_from_circle
    FROM %I c
    LEFT JOIN profiles p ON c.user_id = p.id AND (p.deleted_at IS NULL OR p.id IS NULL)
    WHERE c.%I = %L AND c.is_deleted = false
    ORDER BY c.created_at ASC
  ', comment_type_val, p_table_name, p_current_user_id, comment_type_val, p_current_user_id, p_current_user_id, p_current_user_id, p_table_name, p_id_field, p_item_id);

  RETURN QUERY EXECUTE query;
END;
$$;

-- New toggle_comment_like function
CREATE OR REPLACE FUNCTION public.toggle_comment_like(
  p_comment_id uuid,
  p_comment_type text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_table text;
  comment_exists boolean;
  like_exists boolean;
BEGIN
  -- Validate comment_type
  IF p_comment_type NOT IN ('post', 'recommendation') THEN
    RAISE EXCEPTION 'Invalid comment type: %', p_comment_type;
  END IF;

  -- Determine table
  IF p_comment_type = 'post' THEN
    comment_table := 'post_comments';
  ELSE
    comment_table := 'recommendation_comments';
  END IF;

  -- Verify comment exists
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE id = $1 AND is_deleted = false)', comment_table)
  INTO comment_exists
  USING p_comment_id;

  IF NOT comment_exists THEN
    RAISE EXCEPTION 'Comment not found or deleted';
  END IF;

  -- Check if already liked
  SELECT EXISTS(
    SELECT 1 FROM comment_likes 
    WHERE comment_id = p_comment_id AND comment_type = p_comment_type AND user_id = p_user_id
  ) INTO like_exists;

  IF like_exists THEN
    -- Remove like
    DELETE FROM comment_likes 
    WHERE comment_id = p_comment_id AND comment_type = p_comment_type AND user_id = p_user_id;
    RETURN false;
  ELSE
    -- Add like
    INSERT INTO comment_likes (comment_id, comment_type, user_id)
    VALUES (p_comment_id, p_comment_type, p_user_id);
    RETURN true;
  END IF;
END;
$$;

-- Updated delete_comment with reply handling
CREATE OR REPLACE FUNCTION public.delete_comment(
  p_comment_id uuid,
  p_item_type text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_table text;
  parent_table text;
  id_field text;
  v_item_id uuid;
  v_parent_id uuid;
  reply_count integer;
BEGIN
  IF p_item_type NOT IN ('recommendation', 'post') THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  IF p_item_type = 'recommendation' THEN
    comment_table := 'recommendation_comments';
    id_field := 'recommendation_id';
    parent_table := 'recommendations';
  ELSE
    comment_table := 'post_comments';
    id_field := 'post_id';
    parent_table := 'posts';
  END IF;

  -- Get the comment's item_id and parent_id, verify ownership
  EXECUTE format('
    SELECT %I, parent_id FROM %I WHERE id = $1 AND user_id = $2 AND is_deleted = false
  ', id_field, comment_table)
  INTO v_item_id, v_parent_id
  USING p_comment_id, p_user_id;

  IF v_item_id IS NULL THEN
    RETURN false;
  END IF;

  -- Count active replies (only if this is a top-level comment)
  IF v_parent_id IS NULL THEN
    EXECUTE format('
      SELECT COUNT(*) FROM %I WHERE parent_id = $1 AND is_deleted = false
    ', comment_table)
    INTO reply_count
    USING p_comment_id;
  ELSE
    reply_count := 0;
  END IF;

  -- Soft-delete the comment
  EXECUTE format('
    UPDATE %I SET is_deleted = true, updated_at = now() WHERE id = $1
  ', comment_table)
  USING p_comment_id;

  -- If top-level with replies, also soft-delete all replies
  IF v_parent_id IS NULL AND reply_count > 0 THEN
    EXECUTE format('
      UPDATE %I SET is_deleted = true, updated_at = now() WHERE parent_id = $1 AND is_deleted = false
    ', comment_table)
    USING p_comment_id;
  END IF;

  -- Update comment count: subtract 1 (this comment) + reply_count (its replies)
  EXECUTE format('
    UPDATE %I
    SET comment_count = GREATEST(comment_count - $1, 0)
    WHERE id = $2
  ', parent_table)
  USING (1 + reply_count), v_item_id;

  RETURN true;
END;
$$;

-- Updated update_comment (unchanged signature, just ensuring consistency)
CREATE OR REPLACE FUNCTION public.update_comment(
  p_comment_id uuid,
  p_content text,
  p_user_id uuid,
  p_item_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_table text;
BEGIN
  IF p_item_type NOT IN ('recommendation', 'post') THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  IF p_item_type = 'recommendation' THEN
    comment_table := 'recommendation_comments';
  ELSE
    comment_table := 'post_comments';
  END IF;

  EXECUTE format('
    UPDATE %I 
    SET content = $1, updated_at = now(), edited_at = now()
    WHERE id = $2 AND user_id = $3 AND is_deleted = false
  ', comment_table)
  USING p_content, p_comment_id, p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
