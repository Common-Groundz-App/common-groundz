
-- Create functions to handle review likes and saves in batch

-- Function to get review likes counts by review IDs
CREATE OR REPLACE FUNCTION public.get_review_likes_batch(p_review_ids UUID[])
RETURNS TABLE (
  review_id UUID,
  like_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT rl.review_id, COUNT(rl.*)::BIGINT as like_count
  FROM public.review_likes rl
  WHERE rl.review_id = ANY(p_review_ids)
  GROUP BY rl.review_id;
END;
$$;

-- Function to get user's liked reviews from a list of review IDs
CREATE OR REPLACE FUNCTION public.get_user_review_likes(p_review_ids UUID[], p_user_id UUID)
RETURNS TABLE (
  review_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT rl.review_id
  FROM public.review_likes rl
  WHERE rl.review_id = ANY(p_review_ids) AND rl.user_id = p_user_id;
END;
$$;

-- Function to get user's saved reviews from a list of review IDs
CREATE OR REPLACE FUNCTION public.get_user_review_saves(p_review_ids UUID[], p_user_id UUID)
RETURNS TABLE (
  review_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT rs.review_id
  FROM public.review_saves rs
  WHERE rs.review_id = ANY(p_review_ids) AND rs.user_id = p_user_id;
END;
$$;

-- Toggle like on review with a single function call
CREATE OR REPLACE FUNCTION public.toggle_review_like(p_review_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  like_exists BOOLEAN;
BEGIN
  -- Check if like exists
  SELECT EXISTS(
    SELECT 1 FROM public.review_likes
    WHERE review_id = p_review_id AND user_id = p_user_id
  ) INTO like_exists;
  
  -- Toggle the like
  IF like_exists THEN
    -- Like exists, so delete it
    DELETE FROM public.review_likes
    WHERE review_id = p_review_id AND user_id = p_user_id;
    RETURN false; -- Indicates like was removed
  ELSE
    -- Like doesn't exist, so add it
    INSERT INTO public.review_likes (review_id, user_id)
    VALUES (p_review_id, p_user_id);
    RETURN true; -- Indicates like was added
  END IF;
END;
$$;

-- Toggle save on review with a single function call
CREATE OR REPLACE FUNCTION public.toggle_review_save(p_review_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  save_exists BOOLEAN;
BEGIN
  -- Check if save exists
  SELECT EXISTS(
    SELECT 1 FROM public.review_saves
    WHERE review_id = p_review_id AND user_id = p_user_id
  ) INTO save_exists;
  
  -- Toggle the save
  IF save_exists THEN
    -- Save exists, so delete it
    DELETE FROM public.review_saves
    WHERE review_id = p_review_id AND user_id = p_user_id;
    RETURN false; -- Indicates save was removed
  ELSE
    -- Save doesn't exist, so add it
    INSERT INTO public.review_saves (review_id, user_id)
    VALUES (p_review_id, p_user_id);
    RETURN true; -- Indicates save was added
  END IF;
END;
$$;
