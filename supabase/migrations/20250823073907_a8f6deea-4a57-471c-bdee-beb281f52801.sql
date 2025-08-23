-- Fix get_network_entity_recommendations to use correct column references
DROP FUNCTION IF EXISTS public.get_network_entity_recommendations(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_network_entity_recommendations(
  p_user_id UUID,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE(
  recommendation_id UUID,
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  entity_image_url TEXT,
  rating DECIMAL(2,1),
  description TEXT,
  user_id UUID,
  username TEXT,
  user_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  is_recommended BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as recommendation_id,
    e.id as entity_id,
    e.name as entity_name,
    e.type::TEXT as entity_type,
    e.image_url as entity_image_url,
    r.rating,
    r.description,
    r.user_id,
    p.username,
    p.avatar_url as user_avatar_url,
    r.created_at,
    r.is_recommended
  FROM recommendations r
  JOIN entities e ON r.entity_id = e.id
  JOIN profiles p ON r.user_id = p.id
  WHERE r.entity_id = p_entity_id
    AND r.user_id IN (
      SELECT following_id 
      FROM follows 
      WHERE follower_id = p_user_id
    )
    AND e.is_deleted = false
    AND r.rating >= 3.0
  ORDER BY r.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Update get_fallback_entity_recommendations to use HAVING COUNT >= 1
DROP FUNCTION IF EXISTS public.get_fallback_entity_recommendations(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_fallback_entity_recommendations(
  p_entity_id UUID,
  p_current_user_id UUID,
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE(
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  entity_image_url TEXT,
  avg_rating DECIMAL(2,1),
  recommendation_count INTEGER,
  display_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH entity_stats AS (
    SELECT 
      e.id,
      e.name,
      e.type::TEXT,
      e.image_url,
      ROUND(AVG(r.rating), 1) as avg_rating,
      COUNT(r.id)::INTEGER as rec_count
    FROM entities e
    JOIN recommendations r ON e.id = r.entity_id
    WHERE e.id != p_entity_id
      AND e.is_deleted = false
      AND r.rating >= 4.0
      AND r.created_at >= NOW() - INTERVAL '1 year'
    GROUP BY e.id, e.name, e.type, e.image_url
    HAVING COUNT(r.id) >= 1
  )
  SELECT 
    es.id,
    es.name,
    es.type,
    es.image_url,
    es.avg_rating,
    es.rec_count,
    CASE 
      WHEN es.avg_rating >= 4.5 THEN 'Highly rated'
      WHEN es.rec_count >= 5 THEN 'Popular choice'
      ELSE 'Well reviewed'
    END as display_reason
  FROM entity_stats es
  ORDER BY 
    es.avg_rating DESC,
    es.rec_count DESC
  LIMIT p_limit;
END;
$$;