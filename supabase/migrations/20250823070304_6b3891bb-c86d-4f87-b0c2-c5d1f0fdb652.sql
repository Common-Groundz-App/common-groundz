-- Phase 1: Drop ALL duplicate versions of the functions
DROP FUNCTION IF EXISTS public.has_network_recommendations(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_network_recommendations(p_user_id uuid, p_entity_id uuid);
DROP FUNCTION IF EXISTS public.get_network_entity_recommendations(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.get_network_entity_recommendations(p_user_id uuid, p_entity_id uuid, p_limit integer);
DROP FUNCTION IF EXISTS public.get_fallback_entity_recommendations(uuid, integer);
DROP FUNCTION IF EXISTS public.get_fallback_entity_recommendations(p_entity_id uuid, p_limit integer);
DROP FUNCTION IF EXISTS public.get_fallback_entity_recommendations(p_entity_id uuid, p_current_user_id uuid, p_limit integer);

-- Phase 2: Create clean, single versions with proper column references and SECURITY DEFINER

-- Function to check if user has network recommendations for an entity
CREATE OR REPLACE FUNCTION public.has_network_recommendations(p_user_id uuid, p_entity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec_count INTEGER := 0;
BEGIN
  -- Get count of high-quality recommendations from followed users
  SELECT COUNT(*) INTO rec_count
  FROM public.recommendations r
  INNER JOIN public.follows f ON r.user_id = f.following_id
  WHERE f.follower_id = p_user_id
    AND r.entity_id = p_entity_id
    AND r.visibility = 'public'
    AND r.rating >= 3.5;
    
  RETURN rec_count > 0;
END;
$$;

-- Function to get network entity recommendations
CREATE OR REPLACE FUNCTION public.get_network_entity_recommendations(p_user_id uuid, p_entity_id uuid, p_limit integer DEFAULT 6)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  entity_id uuid,
  title text,
  content text,
  rating integer,
  category recommendation_category,
  visibility recommendation_visibility,
  image_url text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  like_count bigint,
  comment_count integer,
  username text,
  avatar_url text,
  first_name text,
  last_name text,
  score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.user_id,
    r.entity_id,
    r.title,
    r.content,
    r.rating,
    r.category,
    r.visibility,
    r.image_url,
    r.created_at,
    r.updated_at,
    COALESCE(like_counts.like_count, 0) as like_count,
    r.comment_count,
    p.username,
    p.avatar_url,
    p.first_name,
    p.last_name,
    -- Calculate score based on rating, recency, and social connection
    (r.rating::double precision / 5.0 * 0.6) + 
    (EXTRACT(EPOCH FROM (now() - r.created_at)) / -86400.0 * 0.2) + 
    0.2 as score
  FROM public.recommendations r
  INNER JOIN public.follows f ON r.user_id = f.following_id
  INNER JOIN public.profiles p ON r.user_id = p.id
  LEFT JOIN (
    SELECT recommendation_id, COUNT(*) as like_count
    FROM public.recommendation_likes
    GROUP BY recommendation_id
  ) like_counts ON r.id = like_counts.recommendation_id
  WHERE f.follower_id = p_user_id
    AND r.entity_id = p_entity_id
    AND r.visibility = 'public'
    AND r.rating >= 3.5
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$;

-- Function to get fallback entity recommendations
CREATE OR REPLACE FUNCTION public.get_fallback_entity_recommendations(p_entity_id uuid, p_current_user_id uuid DEFAULT NULL, p_limit integer DEFAULT 6)
RETURNS TABLE(
  id uuid,
  entity_id uuid,
  entity_name text,
  entity_type entity_type,
  entity_image_url text,
  entity_description text,
  avg_rating numeric,
  total_recommendations bigint,
  latest_recommendation_date timestamp with time zone,
  trending_score double precision,
  category text,
  reason text,
  score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH entity_stats AS (
    SELECT 
      e.id,
      e.name,
      e.type,
      e.image_url,
      e.description,
      ROUND(AVG(r.rating), 1) as avg_rating,
      COUNT(r.id) as total_recommendations,
      MAX(r.created_at) as latest_recommendation_date,
      COALESCE(e.trending_score, 0) as trending_score,
      e.type::text as category
    FROM public.entities e
    LEFT JOIN public.recommendations r ON e.id = r.entity_id 
      AND r.visibility = 'public' 
      AND r.rating >= 4
    WHERE e.id != p_entity_id
      AND e.visibility = 'public'
    GROUP BY e.id, e.name, e.type, e.image_url, e.description, e.trending_score
    HAVING COUNT(r.id) >= 1 AND AVG(r.rating) >= 4.0
  )
  SELECT 
    es.id,
    es.id as entity_id,
    es.name as entity_name,
    es.type as entity_type,
    es.image_url as entity_image_url,
    es.description as entity_description,
    es.avg_rating,
    es.total_recommendations,
    es.latest_recommendation_date,
    es.trending_score,
    es.category,
    CASE 
      WHEN es.trending_score > 1.0 THEN 'Trending now'
      WHEN es.avg_rating >= 4.5 THEN 'Highly rated'
      ELSE 'Popular choice'
    END as reason,
    -- Calculate composite score
    (es.avg_rating / 5.0 * 0.4) + 
    (LEAST(es.total_recommendations::double precision, 20) / 20.0 * 0.3) + 
    (es.trending_score * 0.3) as score
  FROM entity_stats es
  ORDER BY score DESC, latest_recommendation_date DESC
  LIMIT p_limit;
END;
$$;