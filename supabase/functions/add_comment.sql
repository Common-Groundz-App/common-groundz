
-- Function to add a comment and update comment count (with threading support)
CREATE OR REPLACE FUNCTION add_comment(
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

  EXECUTE format('
    INSERT INTO %I (%I, user_id, content, parent_id)
    VALUES ($1, $2, $3, $4)
  ', comment_table, id_field)
  USING p_item_id, p_user_id, p_content, p_parent_id;

  EXECUTE format('
    UPDATE %I
    SET comment_count = comment_count + 1
    WHERE id = $1
  ', parent_table)
  USING p_item_id;

  RETURN true;
END;
$$;
