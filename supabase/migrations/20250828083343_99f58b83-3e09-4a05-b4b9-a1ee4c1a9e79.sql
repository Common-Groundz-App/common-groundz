-- Fix the network recommendations function - remove restrictive filters and fix field names
DROP FUNCTION IF EXISTS public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(
  p_user_id uuid,
  p_entity_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_type entity_type,
  entity_image_url text,
  average_rating numeric,
  recommendation_count bigint,
  recommender_usernames text[],
  recommender_user_ids uuid[],
  recommender_avatars text[],
  latest_recommendation_date timestamp with time zone,
  has_timeline_updates boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH following_users AS (
    SELECT following_id
    FROM follows
    WHERE follower_id = p_user_id
  ),
  network_reviews AS (
    SELECT 
      r.entity_id,
      r.user_id,
      r.rating,
      r.created_at,
      r.has_timeline,
      r.latest_rating,
      p.username,
      p.avatar_url
    FROM reviews r
    JOIN following_users fu ON r.user_id = fu.following_id
    JOIN profiles p ON r.user_id = p.id
    WHERE r.entity_id != p_entity_id  -- Show OTHER entities, not the current one
      AND r.is_recommended = true
      -- REMOVED: AND r.has_timeline = true  -- This was filtering out most recommendations
      AND r.status = 'published'
  ),
  aggregated_data AS (
    SELECT 
      nr.entity_id,
      ROUND(AVG(COALESCE(nr.latest_rating, nr.rating)), 1) as avg_rating,
      COUNT(*)::bigint as rec_count,
      ARRAY_AGG(nr.username ORDER BY nr.created_at DESC) as recommender_usernames,
      ARRAY_AGG(nr.user_id ORDER BY nr.created_at DESC) as recommender_user_ids,
      ARRAY_AGG(nr.avatar_url ORDER BY nr.created_at DESC) as recommender_avatars,
      MAX(nr.created_at) as latest_date,
      bool_or(nr.has_timeline) as has_timeline_updates
    FROM network_reviews nr
    GROUP BY nr.entity_id
  )
  SELECT 
    ad.entity_id,
    e.name as entity_name,
    e.type as entity_type,
    e.image_url as entity_image_url,
    ad.avg_rating as average_rating,
    ad.rec_count as recommendation_count,
    ad.recommender_usernames,
    ad.recommender_user_ids,
    ad.recommender_avatars,
    ad.latest_date as latest_recommendation_date,
    ad.has_timeline_updates
  FROM aggregated_data ad
  JOIN entities e ON ad.entity_id = e.id
  WHERE e.is_deleted = false
  ORDER BY ad.latest_date DESC
  LIMIT p_limit;
END;
$$;