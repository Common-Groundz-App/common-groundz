-- Update the get_aggregated_network_recommendations_discovery function to return actual recommendation dates
CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(
  p_user_id UUID, 
  p_entity_id UUID, 
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE(
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  entity_image_url TEXT,
  entity_slug TEXT,
  average_rating DECIMAL(2,1),
  recommendation_count INTEGER,
  recommender_user_ids UUID[],
  recommender_usernames TEXT[],
  recommender_avatars TEXT[],
  latest_recommendation_date TIMESTAMP WITH TIME ZONE,
  has_timeline_updates BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_network AS (
    SELECT following_id as network_user_id
    FROM public.follows
    WHERE follower_id = p_user_id
  ),
  aggregated_recs AS (
    SELECT 
      e.id as entity_id,
      e.name as entity_name,
      e.type::TEXT as entity_type,
      e.image_url as entity_image_url,
      e.slug as entity_slug,
      ROUND(AVG(r.rating), 1) as average_rating,
      COUNT(r.id)::INTEGER as recommendation_count,
      ARRAY_AGG(DISTINCT r.user_id) as recommender_user_ids,
      MAX(r.created_at) as latest_recommendation_date,
      BOOL_OR(r.has_timeline) as has_timeline_updates
    FROM public.recommendations r
    JOIN public.entities e ON r.entity_id = e.id
    JOIN user_network un ON r.user_id = un.network_user_id
    WHERE e.id != p_entity_id
      AND e.is_deleted = false
      AND r.visibility = 'public'
    GROUP BY e.id, e.name, e.type, e.image_url, e.slug
    HAVING COUNT(r.id) >= 1
  )
  SELECT 
    ar.entity_id,
    ar.entity_name,
    ar.entity_type,
    ar.entity_image_url,
    ar.entity_slug,
    ar.average_rating,
    ar.recommendation_count,
    ar.recommender_user_ids,
    ARRAY_AGG(DISTINCT p.username ORDER BY p.username) as recommender_usernames,
    ARRAY_AGG(DISTINCT p.avatar_url ORDER BY p.username) as recommender_avatars,
    ar.latest_recommendation_date,
    ar.has_timeline_updates
  FROM aggregated_recs ar
  JOIN public.profiles p ON p.id = ANY(ar.recommender_user_ids)
  GROUP BY 
    ar.entity_id, ar.entity_name, ar.entity_type, ar.entity_image_url, 
    ar.entity_slug, ar.average_rating, ar.recommendation_count, 
    ar.recommender_user_ids, ar.latest_recommendation_date, ar.has_timeline_updates
  ORDER BY ar.latest_recommendation_date DESC
  LIMIT p_limit;
END;
$$;