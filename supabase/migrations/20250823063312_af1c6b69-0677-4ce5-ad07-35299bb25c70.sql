-- Fix the get_network_entity_recommendations function with proper table aliases
CREATE OR REPLACE FUNCTION public.get_network_entity_recommendations(
  p_current_user_id uuid,
  p_entity_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  entity_id uuid,
  entity_name text,
  entity_slug text,
  entity_type entity_type,
  entity_image_url text,
  recommendation_count bigint,
  average_rating numeric,
  recommender_id uuid,
  recommender_username text,
  recommender_avatar_url text,
  latest_recommendation_date timestamptz,
  is_mutual_connection boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH network_recs AS (
    -- Get recommendations from people the user follows
    SELECT 
      e.id as entity_id,
      e.name as entity_name,
      e.slug as entity_slug,
      e.type as entity_type,
      e.image_url as entity_image_url,
      r.user_id as recommender_id,
      r.rating,
      r.created_at as recommendation_date,
      -- Check if connection is mutual
      EXISTS (
        SELECT 1 FROM follows f2 
        WHERE f2.follower_id = r.user_id 
        AND f2.following_id = p_current_user_id
      ) as is_mutual
    FROM recommendations r
    JOIN entities e ON r.entity_id = e.id
    JOIN follows f ON r.user_id = f.following_id
    WHERE f.follower_id = p_current_user_id
      AND r.entity_id != p_entity_id  -- Exclude the current entity
      AND r.visibility = 'public'
      AND e.is_deleted = false
      AND r.rating >= 3.5  -- Quality threshold
      AND r.created_at > NOW() - INTERVAL '90 days'  -- Recency filter
  ),
  aggregated_recs AS (
    SELECT 
      nr.entity_id,
      nr.entity_name,
      nr.entity_slug,
      nr.entity_type,
      nr.entity_image_url,
      COUNT(*)::bigint as recommendation_count,
      ROUND(AVG(nr.rating), 1) as average_rating,
      -- Get the most recent recommender for display
      (ARRAY_AGG(nr.recommender_id ORDER BY nr.recommendation_date DESC))[1] as recommender_id,
      MAX(nr.recommendation_date) as latest_recommendation_date,
      -- Calculate mutual connection score (prefer mutual connections)
      (COUNT(*) FILTER (WHERE nr.is_mutual) * 1.5 + COUNT(*) FILTER (WHERE NOT nr.is_mutual))::numeric as connection_score
    FROM network_recs nr
    GROUP BY nr.entity_id, nr.entity_name, nr.entity_slug, nr.entity_type, nr.entity_image_url
    HAVING COUNT(*) >= 1  -- At least 1 recommendation
  )
  SELECT 
    ar.entity_id,
    ar.entity_name,
    ar.entity_slug,
    ar.entity_type,
    ar.entity_image_url,
    ar.recommendation_count,
    ar.average_rating,
    ar.recommender_id,
    p.username as recommender_username,
    p.avatar_url as recommender_avatar_url,
    ar.latest_recommendation_date,
    EXISTS (
      SELECT 1 FROM follows f1, follows f2 
      WHERE f1.follower_id = p_current_user_id 
      AND f1.following_id = ar.recommender_id
      AND f2.follower_id = ar.recommender_id 
      AND f2.following_id = p_current_user_id
    ) as is_mutual_connection
  FROM aggregated_recs ar
  LEFT JOIN profiles p ON ar.recommender_id = p.id
  ORDER BY 
    ar.connection_score DESC,  -- Prefer mutual connections
    ar.average_rating DESC,    -- Then by rating
    ar.latest_recommendation_date DESC  -- Then by recency
  LIMIT p_limit;
END;
$$;

-- Create helper function to check if user has network recommendations
CREATE OR REPLACE FUNCTION public.has_network_recommendations(
  p_current_user_id uuid,
  p_entity_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM get_network_entity_recommendations(p_current_user_id, p_entity_id, 1)
  );
END;
$$;

-- Fix the get_fallback_entity_recommendations function
CREATE OR REPLACE FUNCTION public.get_fallback_entity_recommendations(
  p_entity_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  entity_id uuid,
  entity_name text,
  entity_slug text,
  entity_type entity_type,
  entity_image_url text,
  recommendation_count bigint,
  average_rating numeric,
  popularity_score numeric,
  trending_score numeric,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH entity_stats AS (
    SELECT 
      e.id as entity_id,
      e.name as entity_name,
      e.slug as entity_slug,
      e.type as entity_type,
      e.image_url as entity_image_url,
      COALESCE(e.popularity_score, 0) as popularity_score,
      COALESCE(e.trending_score, 0) as trending_score,
      -- Count recommendations
      COUNT(r.id)::bigint as recommendation_count,
      COALESCE(ROUND(AVG(r.rating), 1), 0) as average_rating,
      -- Recency boost for trending items
      CASE 
        WHEN MAX(r.created_at) > NOW() - INTERVAL '7 days' THEN 1.5
        WHEN MAX(r.created_at) > NOW() - INTERVAL '30 days' THEN 1.2
        ELSE 1.0
      END as recency_boost
    FROM entities e
    LEFT JOIN recommendations r ON e.id = r.entity_id 
      AND r.visibility = 'public' 
      AND r.rating >= 3.0
    WHERE e.id != p_entity_id
      AND e.is_deleted = false
      AND e.type IS NOT NULL
    GROUP BY e.id, e.name, e.slug, e.type, e.image_url, e.popularity_score, e.trending_score
  ),
  scored_entities AS (
    SELECT 
      *,
      -- Calculate composite score
      (
        (popularity_score * 0.3) + 
        (trending_score * 0.4) + 
        (LEAST(recommendation_count, 10) * 0.2) + 
        (LEAST(average_rating, 5) * 0.1)
      ) * recency_boost as composite_score,
      -- Determine reason
      CASE 
        WHEN trending_score > 5 THEN 'Trending now'
        WHEN average_rating >= 4.5 THEN 'Highly rated'
        WHEN recommendation_count >= 10 THEN 'Popular choice'
        ELSE 'You might like this'
      END as reason
    FROM entity_stats
    WHERE recommendation_count > 0 OR popularity_score > 0 OR trending_score > 0
  )
  SELECT 
    se.entity_id,
    se.entity_name,
    se.entity_slug,
    se.entity_type,
    se.entity_image_url,
    se.recommendation_count,
    se.average_rating,
    se.popularity_score,
    se.trending_score,
    se.reason
  FROM scored_entities se
  ORDER BY se.composite_score DESC, se.average_rating DESC
  LIMIT p_limit;
END;
$$;