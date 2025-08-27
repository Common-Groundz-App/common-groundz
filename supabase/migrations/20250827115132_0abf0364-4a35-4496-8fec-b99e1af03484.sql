-- Drop the existing function first to avoid return type conflict
DROP FUNCTION IF EXISTS public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer);

-- Recreate the function with proper timeline detection logic and no non-existent column references
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
  entity_slug text,
  recommendation_count integer,
  recommender_usernames text[],
  recommender_avatars text[],
  recommender_user_ids uuid[],
  latest_recommendation_date timestamp with time zone,
  circle_rating numeric,
  overall_rating numeric,
  has_timeline_updates boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_following_ids uuid[];
BEGIN
  -- Get the list of users that the current user follows
  SELECT ARRAY_AGG(following_id) INTO user_following_ids
  FROM public.follows
  WHERE follower_id = p_user_id;
  
  -- If user doesn't follow anyone, return empty result
  IF user_following_ids IS NULL OR array_length(user_following_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  
  -- Get aggregated recommendations from network
  RETURN QUERY
  WITH network_recommendations AS (
    SELECT 
      r.entity_id,
      COUNT(r.id) as rec_count,
      ARRAY_AGG(DISTINCT p.username ORDER BY p.username) as usernames,
      ARRAY_AGG(DISTINCT p.avatar_url ORDER BY p.username) as avatars,
      ARRAY_AGG(DISTINCT r.user_id ORDER BY p.username) as user_ids,
      MAX(r.created_at) as latest_date
    FROM public.recommendations r
    JOIN public.profiles p ON r.user_id = p.id
    WHERE r.user_id = ANY(user_following_ids)
      AND r.entity_id != p_entity_id
      AND r.visibility = 'public'
    GROUP BY r.entity_id
    HAVING COUNT(r.id) >= 1
  ),
  timeline_check AS (
    SELECT 
      r.entity_id,
      BOOL_OR(ru.id IS NOT NULL) as has_timeline
    FROM public.recommendations r
    LEFT JOIN public.review_updates ru ON r.id = ru.review_id
    WHERE r.user_id = ANY(user_following_ids)
      AND r.entity_id != p_entity_id
      AND r.visibility = 'public'
    GROUP BY r.entity_id
  )
  SELECT 
    e.id,
    e.name,
    e.type,
    e.image_url,
    e.slug,
    nr.rec_count::integer,
    nr.usernames,
    nr.avatars,
    nr.user_ids,
    nr.latest_date,
    public.get_circle_rating(e.id, p_user_id),
    public.get_overall_rating(e.id),
    COALESCE(tc.has_timeline, false)
  FROM network_recommendations nr
  JOIN public.entities e ON nr.entity_id = e.id
  LEFT JOIN timeline_check tc ON e.id = tc.entity_id
  WHERE e.is_deleted = false
  ORDER BY nr.rec_count DESC, nr.latest_date DESC
  LIMIT p_limit;
END;
$$;