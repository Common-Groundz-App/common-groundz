
-- Function to get comments with profile data (with threading and likes)
CREATE OR REPLACE FUNCTION get_comments_with_profiles(
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
    WHERE c.%I = %L AND c.is_deleted = false
    ORDER BY c.created_at ASC
  ', comment_type_val, p_table_name, p_current_user_id, comment_type_val, p_current_user_id, p_current_user_id, p_current_user_id, p_table_name, p_id_field, p_item_id);

  RETURN QUERY EXECUTE query;
END;
$$;
