-- Drop all versions of has_network_recommendations function
DROP FUNCTION IF EXISTS public.has_network_recommendations(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_network_recommendations(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.has_network_recommendations(uuid, uuid, integer, boolean);

-- Recreate the correct has_network_recommendations function (3 parameters)
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
  network_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO network_count
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
    
  RETURN network_count >= p_min_count;
END;
$$;