
-- Function to get comments with profile data
CREATE OR REPLACE FUNCTION get_comments_with_profiles(
  p_table_name text,
  p_id_field text,
  p_item_id uuid
) 
RETURNS TABLE (
  id uuid,
  content text,
  created_at timestamptz,
  user_id uuid,
  username text,
  avatar_url text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query text;
BEGIN
  IF p_table_name NOT IN ('recommendation_comments', 'post_comments') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  IF p_id_field NOT IN ('recommendation_id', 'post_id') THEN
    RAISE EXCEPTION 'Invalid ID field: %', p_id_field;
  END IF;

  query := format('
    SELECT
      c.id,
      c.content,
      c.created_at,
      c.user_id,
      p.username,
      p.avatar_url
    FROM %I c
    LEFT JOIN profiles p ON c.user_id = p.id
    WHERE c.%I = %L AND c.is_deleted = false
    ORDER BY c.created_at ASC
  ', p_table_name, p_id_field, p_item_id);

  RETURN QUERY EXECUTE query;
END;
$$;
