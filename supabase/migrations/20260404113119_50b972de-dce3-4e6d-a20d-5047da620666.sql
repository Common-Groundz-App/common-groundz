-- Step 1: Drop the old overload that causes PGRST203 ambiguity
DROP FUNCTION IF EXISTS public.delete_comment(uuid, uuid, text);

-- Step 2: Recreate canonical function with auth guard
CREATE OR REPLACE FUNCTION public.delete_comment(p_comment_id uuid, p_item_type text, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  comment_table text;
  parent_table text;
  id_field text;
  v_item_id uuid;
  v_parent_id uuid;
  reply_count integer;
BEGIN
  -- Auth guard: ensure caller is authenticated and matches p_user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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
$function$;

-- Step 3: Restrict execution to authenticated role only
REVOKE ALL ON FUNCTION public.delete_comment(uuid, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_comment(uuid, text, uuid) TO authenticated;