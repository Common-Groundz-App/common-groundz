
-- Function to add a comment and update comment count
CREATE OR REPLACE FUNCTION add_comment(
  p_item_id uuid,
  p_item_type text,
  p_content text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  comment_table text;
  id_field text;
  parent_table text;
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

  -- Insert the comment
  EXECUTE format('
    INSERT INTO %I (%I, user_id, content)
    VALUES ($1, $2, $3)
  ', comment_table, id_field)
  USING p_item_id, p_user_id, p_content;

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
