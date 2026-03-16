DROP FUNCTION IF EXISTS public.get_fallback_entity_recommendations(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_fallback_entity_recommendations(p_entity_id uuid, p_current_user_id uuid, p_limit integer DEFAULT 6)
 RETURNS TABLE(entity_id uuid, entity_name text, entity_type text, entity_image_url text, entity_slug text, avg_rating numeric, recommendation_count integer, display_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH entity_stats AS (
    SELECT 
      e.id,
      e.name,
      e.type::TEXT,
      e.image_url,
      e.slug,
      ROUND(AVG(r.rating), 1) as avg_rating,
      COUNT(r.id)::INTEGER as rec_count
    FROM entities e
    JOIN recommendations r ON e.id = r.entity_id
    WHERE e.id != p_entity_id
      AND e.is_deleted = false
      AND r.rating >= 4.0
      AND r.created_at >= NOW() - INTERVAL '1 year'
    GROUP BY e.id, e.name, e.type, e.image_url, e.slug
    HAVING COUNT(r.id) >= 1
  )
  SELECT 
    es.id,
    es.name,
    es.type,
    es.image_url,
    es.slug,
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
$function$