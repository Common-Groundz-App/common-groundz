
-- Create function to manually increment comment counts
CREATE OR REPLACE FUNCTION public.increment_comment_count(table_name text, item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF table_name = 'posts' THEN
    UPDATE public.posts
    SET comment_count = comment_count + 1
    WHERE id = item_id;
  ELSIF table_name = 'recommendations' THEN
    UPDATE public.recommendations
    SET comment_count = comment_count + 1
    WHERE id = item_id;
  END IF;
END;
$$;
