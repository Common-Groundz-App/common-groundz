-- Update get_network_recommendations_discovery to use reviews table instead of recommendations
CREATE OR REPLACE FUNCTION public.get_network_recommendations_discovery(p_user_id uuid, p_current_entity_id uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, title text, description text, rating numeric, created_at timestamp with time zone, user_id uuid, username text, avatar_url text, entity_id uuid, entity_name text, entity_type entity_type, entity_image_url text, entity_category text, is_same_category boolean, recommendation_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_entity_type entity_type;
BEGIN
  -- Get current entity type for category matching
  SELECT e.type INTO current_entity_type
  FROM entities e
  WHERE e.id = p_current_entity_id;

  RETURN QUERY
  WITH network_recs AS (
    SELECT 
      r.id,
      r.title,
      r.description,
      r.rating,
      r.created_at,
      r.user_id,
      p.username,
      p.avatar_url,
      r.entity_id,
      e.name as entity_name,
      e.type as entity_type,
      e.image_url as entity_image_url,
      e.type::TEXT as entity_category,
      (e.type = current_entity_type) as is_same_category,
      CASE 
        WHEN e.type = current_entity_type THEN 'Same category'
        WHEN r.rating >= 4.5 THEN 'Highly rated'
        WHEN r.created_at > now() - interval '7 days' THEN 'Recent favorite'
        ELSE 'Recommended'
      END as recommendation_reason,
      -- Scoring for ordering: prioritize same category, high ratings, recency
      (
        CASE WHEN e.type = current_entity_type THEN 3.0 ELSE 0.0 END +
        (r.rating::FLOAT / 5.0 * 2.0) +
        CASE WHEN r.created_at > now() - interval '7 days' THEN 1.0 
             WHEN r.created_at > now() - interval '30 days' THEN 0.5 
             ELSE 0.0 END
      ) as discovery_score
    FROM reviews r
    JOIN entities e ON r.entity_id = e.id
    JOIN profiles p ON r.user_id = p.id
    WHERE r.user_id IN (
        SELECT following_id 
        FROM follows 
        WHERE follower_id = p_user_id
      )
      AND e.is_deleted = false
      AND r.entity_id != p_current_entity_id -- Exclude current entity
      AND r.is_recommended = true -- Only include reviews marked as recommendations
      AND r.status = 'published' -- Only include published reviews
      AND r.rating >= 3.0
      AND r.created_at > now() - interval '6 months'
    ORDER BY discovery_score DESC, r.created_at DESC
    LIMIT p_limit * 2 -- Get extra to allow for deduplication
  )
  SELECT DISTINCT ON (nr.entity_id)
    nr.id,
    nr.title,
    nr.description,
    nr.rating,
    nr.created_at,
    nr.user_id,
    nr.username,
    nr.avatar_url,
    nr.entity_id,
    nr.entity_name,
    nr.entity_type,
    nr.entity_image_url,
    nr.entity_category,
    nr.is_same_category,
    nr.recommendation_reason
  FROM network_recs nr
  ORDER BY nr.entity_id, nr.discovery_score DESC
  LIMIT p_limit;
END;
$function$