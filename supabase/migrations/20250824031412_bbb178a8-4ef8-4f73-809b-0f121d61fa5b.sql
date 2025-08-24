-- Drop all existing has_network_recommendations functions to resolve conflicts
DROP FUNCTION IF EXISTS public.has_network_recommendations(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.has_network_recommendations(UUID, INTEGER);

-- Create single has_network_recommendations function that matches frontend usage
CREATE OR REPLACE FUNCTION public.has_network_recommendations(
  p_user_id UUID,
  p_entity_id UUID,
  p_min_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_count INTEGER;
BEGIN
  -- Count recommendations from followed users for this specific entity
  SELECT COUNT(*) INTO rec_count
  FROM recommendations r
  JOIN entities e ON r.entity_id = e.id
  WHERE r.entity_id = p_entity_id
    AND r.user_id IN (
      SELECT following_id 
      FROM follows 
      WHERE follower_id = p_user_id
    )
    AND e.is_deleted = false
    AND r.rating >= 3.0;
    
  RETURN rec_count >= p_min_count;
END;
$$;