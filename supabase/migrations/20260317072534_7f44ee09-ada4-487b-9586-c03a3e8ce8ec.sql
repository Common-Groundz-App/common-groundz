CREATE OR REPLACE FUNCTION public.has_network_activity(
  p_user_id uuid,
  p_min_count integer DEFAULT 3
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_count INTEGER;
BEGIN
  -- Count total recommendations from followed users using reviews table
  SELECT COUNT(*) INTO rec_count
  FROM reviews r
  JOIN entities e ON r.entity_id = e.id
  WHERE r.user_id IN (
      SELECT following_id 
      FROM follows 
      WHERE follower_id = p_user_id
    )
    AND e.is_deleted = false
    AND r.is_recommended = true
    AND r.status = 'published';
    
  RETURN rec_count >= p_min_count;
END;
$$;