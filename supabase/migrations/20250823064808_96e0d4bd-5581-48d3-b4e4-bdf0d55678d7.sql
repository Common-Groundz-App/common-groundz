-- Clean up and recreate database functions with proper SQL

-- Drop all duplicate/existing functions first
DROP FUNCTION IF EXISTS public.has_network_recommendations(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_network_recommendations(text, text);
DROP FUNCTION IF EXISTS public.get_network_entity_recommendations(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.get_network_entity_recommendations(text, text, integer);
DROP FUNCTION IF EXISTS public.get_fallback_entity_recommendations(uuid, integer);
DROP FUNCTION IF EXISTS public.get_fallback_entity_recommendations(text, integer);

-- Create clean has_network_recommendations function
CREATE OR REPLACE FUNCTION public.has_network_recommendations(
  p_current_user_id uuid,
  p_entity_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  network_count INTEGER := 0;
BEGIN
  -- Count quality recommendations from user's network
  SELECT COUNT(*) INTO network_count
  FROM public.recommendations r
  JOIN public.follows f ON r.user_id = f.following_id
  WHERE f.follower_id = p_current_user_id
    AND r.entity_id = p_entity_id
    AND r.rating >= 3.5
    AND r.is_deleted = false;
  
  -- Return true if we have at least 2 quality recommendations
  RETURN network_count >= 2;
END;
$$;

-- Create clean get_network_entity_recommendations function
CREATE OR REPLACE FUNCTION public.get_network_entity_recommendations(
  p_current_user_id uuid,
  p_entity_id uuid,
  p_limit integer DEFAULT 6
) RETURNS TABLE (
  entity_id uuid,
  entity_name text,
  entity_slug text,
  entity_type entity_type,
  entity_image_url text,
  recommender_id uuid,
  recommender_username text,
  recommender_avatar_url text,
  average_rating numeric,
  recommendation_count bigint,
  latest_recommendation_date timestamp with time zone,
  is_mutual_connection boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as entity_id,
    e.name as entity_name,
    e.slug as entity_slug,
    e.type as entity_type,
    e.image_url as entity_image_url,
    p.id as recommender_id,
    p.username as recommender_username,
    p.avatar_url as recommender_avatar_url,
    AVG(r.rating) as average_rating,
    COUNT(r.id) as recommendation_count,
    MAX(r.created_at) as latest_recommendation_date,
    EXISTS(
      SELECT 1 FROM public.follows f2 
      WHERE f2.follower_id = r.user_id 
      AND f2.following_id = p_current_user_id
    ) as is_mutual_connection
  FROM public.recommendations r
  JOIN public.follows f ON r.user_id = f.following_id
  JOIN public.entities e ON r.entity_id = e.id
  JOIN public.profiles p ON r.user_id = p.id
  WHERE f.follower_id = p_current_user_id
    AND r.entity_id != p_entity_id -- Exclude the current entity
    AND r.rating >= 3.5
    AND r.is_deleted = false
    AND e.is_deleted = false
  GROUP BY e.id, e.name, e.slug, e.type, e.image_url, p.id, p.username, p.avatar_url, r.user_id
  ORDER BY average_rating DESC, recommendation_count DESC
  LIMIT p_limit;
END;
$$;

-- Create clean get_fallback_entity_recommendations function
CREATE OR REPLACE FUNCTION public.get_fallback_entity_recommendations(
  p_entity_id uuid,
  p_limit integer DEFAULT 6
) RETURNS TABLE (
  entity_id uuid,
  entity_name text,
  entity_slug text,
  entity_type entity_type,
  entity_image_url text,
  average_rating numeric,
  recommendation_count bigint,
  popularity_score double precision,
  trending_score double precision,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as entity_id,
    e.name as entity_name,
    e.slug as entity_slug,
    e.type as entity_type,
    e.image_url as entity_image_url,
    COALESCE(AVG(r.rating), 0) as average_rating,
    COUNT(r.id) as recommendation_count,
    COALESCE(e.popularity_score, 0) as popularity_score,
    COALESCE(e.trending_score, 0) as trending_score,
    CASE 
      WHEN e.trending_score > 0.7 THEN 'Trending now'
      WHEN COUNT(r.id) > 10 THEN 'Popular choice'
      WHEN AVG(r.rating) >= 4.5 THEN 'Highly rated'
      ELSE 'Recommended'
    END as reason
  FROM public.entities e
  LEFT JOIN public.recommendations r ON e.id = r.entity_id AND r.is_deleted = false
  WHERE e.id != p_entity_id
    AND e.is_deleted = false
    AND (r.id IS NULL OR r.rating >= 3.0)
  GROUP BY e.id, e.name, e.slug, e.type, e.image_url, e.popularity_score, e.trending_score
  HAVING COUNT(r.id) > 0 OR e.popularity_score > 0
  ORDER BY 
    COALESCE(e.trending_score, 0) * 0.4 + 
    COALESCE(AVG(r.rating), 0) * 0.3 + 
    COALESCE(e.popularity_score, 0) * 0.3 DESC
  LIMIT p_limit;
END;
$$;