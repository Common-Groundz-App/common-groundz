
-- Fix: cast net_score to double precision to match RETURNS TABLE declaration
DROP FUNCTION IF EXISTS public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(
  p_user_id uuid,
  p_entity_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_type public.entity_type,
  entity_image_url text,
  entity_slug text,
  parent_id uuid,
  parent_slug text,
  average_rating numeric,
  recommendation_count integer,
  recommender_user_ids uuid[],
  recommender_usernames text[],
  recommender_avatars text[],
  latest_recommendation_date timestamptz,
  network_score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_network AS (
    SELECT following_id as network_user_id
    FROM follows 
    WHERE follower_id = p_user_id
  ),
  network_reviews AS (
    SELECT 
      r.entity_id,
      r.user_id as recommender_id,
      r.rating,
      r.created_at,
      (SELECT COUNT(*) FROM follows WHERE following_id = r.user_id) * 0.1 + 
      (r.rating / 5.0) * 0.9 as influence_score
    FROM reviews r
    INNER JOIN user_network un ON r.user_id = un.network_user_id
    WHERE r.is_recommended = true
      AND r.status = 'published'
  ),
  aggregated_data AS (
    SELECT 
      nr.entity_id,
      ROUND(AVG(nr.rating), 1) as avg_rating,
      COUNT(DISTINCT nr.recommender_id)::INTEGER as rec_count,
      ARRAY_AGG(DISTINCT nr.recommender_id) as rec_user_ids,
      MAX(nr.created_at) as latest_date,
      SUM(
        nr.influence_score * 
        EXP(-EXTRACT(days FROM (now() - nr.created_at)) / 30.0)
      )::double precision as net_score
    FROM network_reviews nr
    GROUP BY nr.entity_id
    HAVING COUNT(DISTINCT nr.recommender_id) >= 1
  )
  SELECT 
    e.id as entity_id,
    e.name as entity_name,
    e.type as entity_type,
    e.image_url as entity_image_url,
    e.slug as entity_slug,
    parent_entity.id as parent_id,
    parent_entity.slug as parent_slug,
    ad.avg_rating as average_rating,
    ad.rec_count as recommendation_count,
    ad.rec_user_ids as recommender_user_ids,
    ARRAY(
      SELECT p.username 
      FROM profiles p 
      WHERE p.id = ANY(ad.rec_user_ids)
      ORDER BY p.username
    ) as recommender_usernames,
    ARRAY(
      SELECT p.avatar_url 
      FROM profiles p 
      WHERE p.id = ANY(ad.rec_user_ids)
      ORDER BY p.username
    ) as recommender_avatars,
    ad.latest_date as latest_recommendation_date,
    ad.net_score as network_score
  FROM aggregated_data ad
  INNER JOIN entities e ON ad.entity_id = e.id
  LEFT JOIN entities parent_entity ON e.parent_id = parent_entity.id
  WHERE e.is_deleted = false
    AND e.id != p_entity_id
  ORDER BY ad.net_score DESC, ad.latest_date DESC
  LIMIT p_limit;
END;
$$;
