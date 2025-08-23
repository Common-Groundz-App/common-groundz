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

-- Create the fallback recommendations function
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