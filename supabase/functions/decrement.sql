
CREATE OR REPLACE FUNCTION public.decrement_comment_count(p_table_name text, p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_table_name = 'posts' THEN
    UPDATE public.posts
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = p_item_id;
  ELSIF p_table_name = 'recommendations' THEN
    UPDATE public.recommendations
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = p_item_id;
  END IF;
END;
$$;
