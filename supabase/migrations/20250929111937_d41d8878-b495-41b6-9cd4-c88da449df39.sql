-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_aggregated_network_recommendations_discovery(UUID, UUID, INTEGER);

-- Recreate the function with real entity slugs and parent context
CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(
  p_user_id UUID,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  entity_image_url TEXT,
  entity_slug TEXT,
  parent_slug TEXT,
  average_rating DECIMAL(2,1),
  recommendation_count INTEGER,
  recommender_user_ids UUID[],
  recommender_usernames TEXT[],
  recommender_avatars TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH network_recommendations AS (
    SELECT 
      r.entity_id,
      r.user_id,
      r.rating,
      p.username,
      p.avatar_url
    FROM public.recommendations r
    JOIN public.follows f ON r.user_id = f.following_id
    JOIN public.profiles p ON r.user_id = p.id
    WHERE f.follower_id = p_user_id
      AND r.entity_id = p_entity_id
      AND r.rating >= 3
  ),
  aggregated_data AS (
    SELECT 
      nr.entity_id,
      AVG(nr.rating) as avg_rating,
      COUNT(*) as rec_count,
      ARRAY_AGG(nr.user_id ORDER BY nr.rating DESC) as user_ids,
      ARRAY_AGG(nr.username ORDER BY nr.rating DESC) as usernames,
      ARRAY_AGG(nr.avatar_url ORDER BY nr.rating DESC) as avatars
    FROM network_recommendations nr
    GROUP BY nr.entity_id
  )
  SELECT 
    e.id as entity_id,
    e.name as entity_name,
    e.type::TEXT as entity_type,
    e.image_url as entity_image_url,
    e.slug as entity_slug,
    parent_entity.slug as parent_slug,
    ad.avg_rating as average_rating,
    ad.rec_count as recommendation_count,
    ad.user_ids as recommender_user_ids,
    ad.usernames as recommender_usernames,
    ad.avatars as recommender_avatars
  FROM aggregated_data ad
  JOIN public.entities e ON ad.entity_id = e.id
  LEFT JOIN public.entities parent_entity ON e.parent_id = parent_entity.id
  WHERE e.is_deleted = false
  ORDER BY ad.avg_rating DESC, ad.rec_count DESC
  LIMIT p_limit;
END;
$$;