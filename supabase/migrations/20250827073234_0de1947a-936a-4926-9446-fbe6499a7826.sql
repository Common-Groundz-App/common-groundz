-- Fix get_network_recommendations_discovery function to return correct field names
CREATE OR REPLACE FUNCTION public.get_network_recommendations_discovery(
  p_user_id uuid,
  p_current_entity_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_type entity_type,
  rating numeric,
  review_count bigint,
  username text,
  avatar_url text,
  user_id uuid,
  created_at timestamp with time zone,
  entity_image_url text,
  entity_venue text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (e.id)
    e.id as entity_id,
    e.name as entity_name,
    e.type as entity_type,
    r.rating::numeric as rating,
    COUNT(r2.id) OVER (PARTITION BY e.id) as review_count,
    p.username as username,
    p.avatar_url as avatar_url,
    r.user_id as user_id,
    r.created_at as created_at,
    e.image_url as entity_image_url,
    e.venue as entity_venue
  FROM reviews r
  JOIN entities e ON r.entity_id = e.id AND e.is_deleted = false
  JOIN profiles p ON r.user_id = p.id
  JOIN follows f ON r.user_id = f.following_id
  LEFT JOIN reviews r2 ON e.id = r2.entity_id AND r2.status = 'published'
  WHERE f.follower_id = p_user_id
    AND r.is_recommended = true
    AND r.status = 'published'
    AND r.entity_id != p_current_entity_id
  ORDER BY e.id, r.created_at DESC
  LIMIT p_limit;
END;
$$;