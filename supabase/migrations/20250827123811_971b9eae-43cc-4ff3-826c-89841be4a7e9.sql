-- Fix the aggregated network recommendations function
DROP FUNCTION IF EXISTS public.get_aggregated_network_recommendations_discovery(uuid, uuid[], integer);

CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(
  p_user_id uuid,
  p_following_ids uuid[],
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  entity_id uuid,
  entity_name text,
  entity_type entity_type,
  entity_image_url text,
  entity_venue text,
  recommender_usernames text[],
  recommender_avatars text[],
  recommender_user_ids uuid[],
  recommendation_count bigint,
  average_rating numeric,
  recent_activity_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH network_recommendations AS (
    SELECT DISTINCT
      r.entity_id,
      r.user_id as recommender_id,
      COALESCE(r.latest_rating, r.rating) as effective_rating,
      r.created_at,
      p.username,
      p.avatar_url
    FROM public.reviews r
    JOIN public.profiles p ON r.user_id = p.id
    WHERE r.user_id = ANY(p_following_ids)
      AND r.status = 'published'
      AND r.is_recommended = true
      AND r.user_id != p_user_id
  ),
  aggregated_recs AS (
    SELECT 
      nr.entity_id,
      -- Use simple array aggregation without DISTINCT to avoid ORDER BY issues
      array_agg(nr.username ORDER BY nr.created_at DESC) as usernames,
      array_agg(nr.avatar_url ORDER BY nr.created_at DESC) as avatars,
      array_agg(nr.recommender_id ORDER BY nr.created_at DESC) as user_ids,
      COUNT(*)::bigint as rec_count,
      ROUND(AVG(nr.effective_rating), 1) as avg_rating,
      COUNT(*) FILTER (WHERE nr.created_at > now() - interval '30 days')::bigint as recent_count
    FROM network_recommendations nr
    GROUP BY nr.entity_id
    HAVING COUNT(*) > 0
  )
  SELECT 
    ar.entity_id,
    e.name as entity_name,
    e.type as entity_type,
    e.image_url as entity_image_url,
    e.venue as entity_venue,
    -- Remove duplicates in application code if needed, keep all entries for now
    ar.usernames as recommender_usernames,
    ar.avatars as recommender_avatars,
    ar.user_ids as recommender_user_ids,
    ar.rec_count as recommendation_count,
    ar.avg_rating as average_rating,
    ar.recent_count as recent_activity_count
  FROM aggregated_recs ar
  JOIN public.entities e ON ar.entity_id = e.id
  WHERE e.is_deleted = false
  ORDER BY ar.recent_count DESC, ar.rec_count DESC, ar.avg_rating DESC
  LIMIT p_limit;
END;
$$;