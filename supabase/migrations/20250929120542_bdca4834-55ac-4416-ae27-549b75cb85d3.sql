-- Update get_aggregated_network_recommendations_discovery to include parent_id
DROP FUNCTION IF EXISTS get_aggregated_network_recommendations_discovery(uuid, integer);

CREATE OR REPLACE FUNCTION get_aggregated_network_recommendations_discovery(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  entity_id UUID,
  entity_name TEXT,
  entity_type entity_type,
  entity_image_url TEXT,
  entity_slug TEXT,
  parent_id UUID,
  parent_slug TEXT,
  average_rating DECIMAL(2,1),
  recommendation_count INTEGER,
  recommender_ids UUID[],
  recommender_names TEXT[],
  recommender_avatars TEXT[],
  latest_recommendation_date TIMESTAMP WITH TIME ZONE,
  network_score DOUBLE PRECISION
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
  network_recommendations AS (
    SELECT 
      r.entity_id,
      r.user_id as recommender_id,
      r.rating,
      r.created_at,
      -- Calculate influence score based on follower count and rating quality
      (SELECT COUNT(*) FROM follows WHERE following_id = r.user_id) * 0.1 + 
      (r.rating / 5.0) * 0.9 as influence_score
    FROM recommendations r
    INNER JOIN user_network un ON r.user_id = un.network_user_id
    WHERE r.visibility = 'public'
      AND r.created_at > now() - interval '90 days'
  ),
  aggregated_data AS (
    SELECT 
      nr.entity_id,
      ROUND(AVG(nr.rating), 1) as avg_rating,
      COUNT(DISTINCT nr.recommender_id)::INTEGER as rec_count,
      ARRAY_AGG(DISTINCT nr.recommender_id) as recommender_ids,
      MAX(nr.created_at) as latest_date,
      -- Network score: weighted by influence and recency
      SUM(
        nr.influence_score * 
        EXP(-EXTRACT(days FROM (now() - nr.created_at)) / 30.0)
      ) as network_score
    FROM network_recommendations nr
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
    ad.recommender_ids,
    ARRAY(
      SELECT p.username 
      FROM profiles p 
      WHERE p.id = ANY(ad.recommender_ids)
      ORDER BY p.username
    ) as recommender_names,
    ARRAY(
      SELECT p.avatar_url 
      FROM profiles p 
      WHERE p.id = ANY(ad.recommender_ids)
      ORDER BY p.username
    ) as recommender_avatars,
    ad.latest_date as latest_recommendation_date,
    ad.network_score
  FROM aggregated_data ad
  INNER JOIN entities e ON ad.entity_id = e.id
  LEFT JOIN entities parent_entity ON e.parent_id = parent_entity.id
  WHERE e.is_deleted = false
  ORDER BY ad.network_score DESC, ad.latest_date DESC
  LIMIT p_limit;
END;
$$;