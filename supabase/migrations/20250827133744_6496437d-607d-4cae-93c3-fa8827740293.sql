-- Drop and recreate the get_aggregated_network_recommendations_discovery function to fix DISTINCT/ORDER BY conflict
DROP FUNCTION IF EXISTS public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(
  current_user_id uuid,
  entity_id_param uuid,
  limit_param integer DEFAULT 10
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_type entity_type,
  entity_image_url text,
  entity_slug text,
  average_rating numeric,
  recommendation_count bigint,
  recommender_usernames text[],
  recommender_avatars text[],
  recommender_user_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH network_reviews AS (
    -- Remove DISTINCT here and use GROUP BY instead to avoid conflicts
    SELECT 
      r.entity_id,
      r.user_id,
      r.id as review_id,
      r.rating,
      r.created_at,
      p.username,
      p.avatar_url
    FROM public.reviews r
    JOIN public.follows f ON r.user_id = f.following_id
    JOIN public.profiles p ON r.user_id = p.id
    WHERE f.follower_id = current_user_id
      AND r.status = 'published'
      AND r.entity_id != entity_id_param
    GROUP BY r.entity_id, r.user_id, r.id, r.rating, r.created_at, p.username, p.avatar_url
  ),
  aggregated_data AS (
    SELECT 
      nr.entity_id,
      AVG(nr.rating) as avg_rating,
      COUNT(*) as rec_count,
      ARRAY_AGG(nr.username ORDER BY nr.created_at DESC) as usernames,
      ARRAY_AGG(nr.avatar_url ORDER BY nr.created_at DESC) as avatars,
      ARRAY_AGG(nr.user_id ORDER BY nr.created_at DESC) as user_ids
    FROM network_reviews nr
    GROUP BY nr.entity_id
  )
  SELECT 
    ad.entity_id,
    e.name as entity_name,
    e.type as entity_type,
    e.image_url as entity_image_url,
    e.slug as entity_slug,
    ROUND(ad.avg_rating, 1) as average_rating,
    ad.rec_count as recommendation_count,
    ad.usernames as recommender_usernames,
    ad.avatars as recommender_avatars,
    ad.user_ids as recommender_user_ids
  FROM aggregated_data ad
  JOIN public.entities e ON ad.entity_id = e.id
  WHERE e.is_deleted = false
  ORDER BY ad.rec_count DESC, ad.avg_rating DESC
  LIMIT limit_param;
END;
$function$;