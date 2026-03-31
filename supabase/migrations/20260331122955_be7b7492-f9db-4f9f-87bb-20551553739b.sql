-- Fix 1: update_comment - remove edited_at = now() (column doesn't exist)
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
    SET content = $1, updated_at = now()
    WHERE id = $2 AND user_id = $3 AND is_deleted = false
  ', comment_table)
  USING p_content, p_comment_id, p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Fix 2: toggle_comment_like - add auth.uid() validation
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
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_comment_type NOT IN ('post', 'recommendation') THEN
    RAISE EXCEPTION 'Invalid comment type: %', p_comment_type;
  END IF;

  IF p_comment_type = 'post' THEN
    comment_table := 'post_comments';
  ELSE
    comment_table := 'recommendation_comments';
  END IF;

  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE id = $1 AND is_deleted = false)', comment_table)
  INTO comment_exists
  USING p_comment_id;

  IF NOT comment_exists THEN
    RAISE EXCEPTION 'Comment not found or deleted';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM comment_likes 
    WHERE comment_id = p_comment_id AND comment_type = p_comment_type AND user_id = p_user_id
  ) INTO like_exists;

  IF like_exists THEN
    DELETE FROM comment_likes 
    WHERE comment_id = p_comment_id AND comment_type = p_comment_type AND user_id = p_user_id;
    RETURN false;
  ELSE
    INSERT INTO comment_likes (comment_id, comment_type, user_id)
    VALUES (p_comment_id, p_comment_type, p_user_id);
    RETURN true;
  END IF;
END;
$$;

-- Fix 3: get_comments_with_profiles - use parameterized $1 for p_item_id
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
    WHERE c.%I = $1 AND c.is_deleted = false
    ORDER BY c.created_at ASC
  ', comment_type_val, p_table_name, p_current_user_id, comment_type_val, p_current_user_id, p_current_user_id, p_current_user_id, p_table_name, p_id_field);

  RETURN QUERY EXECUTE query USING p_item_id;
END;
$$;