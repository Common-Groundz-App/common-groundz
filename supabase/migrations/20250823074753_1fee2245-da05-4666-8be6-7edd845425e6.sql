-- Drop and recreate get_network_entity_recommendations function to fix is_recommended column issue
DROP FUNCTION IF EXISTS public.get_network_entity_recommendations(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_network_entity_recommendations(
  p_user_id UUID,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  entity_id UUID,
  title TEXT,
  description TEXT,
  rating DECIMAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  category recommendation_category,
  visibility recommendation_visibility,
  is_recommended BOOLEAN,
  username TEXT,
  avatar_url TEXT,
  entity_name TEXT,
  entity_type entity_type,
  entity_image_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.user_id,
    r.entity_id,
    r.title,
    r.description,
    r.rating,
    r.created_at,
    r.updated_at,
    r.category,
    r.visibility,
    (r.rating >= 4.0) as is_recommended,  -- Calculate is_recommended based on rating
    p.username,
    p.avatar_url,
    e.name as entity_name,
    e.type as entity_type,
    e.image_url as entity_image_url
  FROM recommendations r
  JOIN entities e ON r.entity_id = e.id
  LEFT JOIN profiles p ON r.user_id = p.id
  WHERE r.entity_id = p_entity_id
    AND r.user_id IN (
      SELECT following_id 
      FROM follows 
      WHERE follower_id = p_user_id
    )
    AND e.is_deleted = false
    AND r.rating >= 3.0
  ORDER BY r.rating DESC, r.created_at DESC
  LIMIT p_limit;
END;
$$;