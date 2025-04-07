
-- Create DB functions to handle post likes and saves
-- Function to check if a post like exists
CREATE OR REPLACE FUNCTION public.check_post_like(p_post_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.post_likes 
    WHERE post_id = p_post_id AND user_id = p_user_id
  );
END;
$$;

-- Function to delete a post like
CREATE OR REPLACE FUNCTION public.delete_post_like(p_post_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.post_likes 
  WHERE post_id = p_post_id AND user_id = p_user_id;
END;
$$;

-- Function to insert a post like
CREATE OR REPLACE FUNCTION public.insert_post_like(p_post_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.post_likes (post_id, user_id)
  VALUES (p_post_id, p_user_id);
END;
$$;

-- Function to check if a post save exists
CREATE OR REPLACE FUNCTION public.check_post_save(p_post_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.post_saves 
    WHERE post_id = p_post_id AND user_id = p_user_id
  );
END;
$$;

-- Function to delete a post save
CREATE OR REPLACE FUNCTION public.delete_post_save(p_post_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.post_saves 
  WHERE post_id = p_post_id AND user_id = p_user_id;
END;
$$;

-- Function to insert a post save
CREATE OR REPLACE FUNCTION public.insert_post_save(p_post_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.post_saves (post_id, user_id)
  VALUES (p_post_id, p_user_id);
END;
$$;

-- Function to get post likes counts by post IDs
CREATE OR REPLACE FUNCTION public.get_post_likes_by_posts(p_post_ids UUID[])
RETURNS TABLE (
  post_id UUID,
  like_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT pl.post_id, COUNT(pl.*)::BIGINT as like_count
  FROM public.post_likes pl
  WHERE pl.post_id = ANY(p_post_ids)
  GROUP BY pl.post_id;
END;
$$;

-- Function to get user's liked posts from a list of post IDs
CREATE OR REPLACE FUNCTION public.get_user_post_likes(p_post_ids UUID[], p_user_id UUID)
RETURNS TABLE (
  post_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT pl.post_id
  FROM public.post_likes pl
  WHERE pl.post_id = ANY(p_post_ids) AND pl.user_id = p_user_id;
END;
$$;

-- Function to get user's saved posts from a list of post IDs
CREATE OR REPLACE FUNCTION public.get_user_post_saves(p_post_ids UUID[], p_user_id UUID)
RETURNS TABLE (
  post_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ps.post_id
  FROM public.post_saves ps
  WHERE ps.post_id = ANY(p_post_ids) AND ps.user_id = p_user_id;
END;
$$;
