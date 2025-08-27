-- Create aggregated network recommendations discovery function
CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(
  p_user_id UUID,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  entity_id UUID,
  entity_name TEXT,
  entity_type entity_type,
  entity_image_url TEXT,
  entity_venue TEXT,
  entity_slug TEXT,
  circle_rating NUMERIC,
  overall_rating NUMERIC,
  recommendation_count INTEGER,
  recommender_usernames TEXT[],
  recommender_avatars TEXT[],
  recommender_user_ids UUID[],
  latest_recommendation_date TIMESTAMP WITH TIME ZONE,
  has_timeline_updates BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH following_users AS (
    SELECT following_id 
    FROM follows 
    WHERE follower_id = p_user_id
  ),
  network_recommendations AS (
    SELECT 
      r.entity_id,
      r.user_id,
      r.created_at,
      r.rating,
      p.username,
      p.avatar_url,
      e.name as entity_name,
      e.type as entity_type,
      e.image_url as entity_image_url,
      e.venue as entity_venue,
      e.slug as entity_slug,
      CASE WHEN r.latest_rating IS NOT NULL THEN true ELSE false END as has_timeline
    FROM recommendations r
    JOIN entities e ON r.entity_id = e.id
    LEFT JOIN profiles p ON r.user_id = p.id
    WHERE r.user_id IN (SELECT following_id FROM following_users)
      AND r.entity_id != p_entity_id
      AND e.is_deleted = false
      AND r.visibility = 'public'
  ),
  aggregated_data AS (
    SELECT 
      nr.entity_id,
      nr.entity_name,
      nr.entity_type,
      nr.entity_image_url,
      nr.entity_venue,
      nr.entity_slug,
      COUNT(*)::INTEGER as recommendation_count,
      ARRAY_AGG(COALESCE(nr.username, 'Unknown User') ORDER BY nr.created_at DESC) as recommender_usernames,
      ARRAY_AGG(nr.avatar_url ORDER BY nr.created_at DESC) as recommender_avatars,
      ARRAY_AGG(nr.user_id ORDER BY nr.created_at DESC) as recommender_user_ids,
      MAX(nr.created_at) as latest_recommendation_date,
      BOOL_OR(nr.has_timeline) as has_timeline_updates
    FROM network_recommendations nr
    GROUP BY nr.entity_id, nr.entity_name, nr.entity_type, nr.entity_image_url, nr.entity_venue, nr.entity_slug
  )
  SELECT 
    ad.entity_id,
    ad.entity_name,
    ad.entity_type,
    ad.entity_image_url,
    ad.entity_venue,
    ad.entity_slug,
    public.get_circle_rating(ad.entity_id, p_user_id) as circle_rating,
    public.get_overall_rating(ad.entity_id) as overall_rating,
    ad.recommendation_count,
    ad.recommender_usernames,
    ad.recommender_avatars,
    ad.recommender_user_ids,
    ad.latest_recommendation_date,
    ad.has_timeline_updates
  FROM aggregated_data ad
  ORDER BY 
    ad.recommendation_count DESC,
    COALESCE(public.get_circle_rating(ad.entity_id, p_user_id), public.get_overall_rating(ad.entity_id), 0) DESC,
    ad.latest_recommendation_date DESC
  LIMIT p_limit;
END;
$$;