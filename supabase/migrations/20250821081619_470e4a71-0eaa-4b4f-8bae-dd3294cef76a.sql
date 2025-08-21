-- Create function to get network entity recommendations
-- This function returns entities recommended by users in the current user's network
CREATE OR REPLACE FUNCTION public.get_network_entity_recommendations(
  p_entity_id uuid,
  p_current_user_id uuid,
  p_limit integer DEFAULT 6
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_type entity_type,
  entity_image_url text,
  entity_slug text,
  average_rating numeric,
  recommendation_count integer,
  recommender_id uuid,
  recommender_username text,
  recommender_avatar_url text,
  is_mutual_connection boolean,
  latest_recommendation_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH network_recommendations AS (
    SELECT DISTINCT
      r.entity_id,
      r.user_id as recommender_id,
      r.rating,
      r.created_at as recommendation_date,
      p.username as recommender_username,
      p.avatar_url as recommender_avatar_url,
      -- Check if it's a mutual connection
      EXISTS(
        SELECT 1 FROM follows f1 
        WHERE f1.follower_id = p_current_user_id 
        AND f1.following_id = r.user_id
      ) AND EXISTS(
        SELECT 1 FROM follows f2 
        WHERE f2.follower_id = r.user_id 
        AND f2.following_id = p_current_user_id
      ) as is_mutual
    FROM recommendations r
    JOIN profiles p ON r.user_id = p.id
    WHERE r.entity_id != p_entity_id  -- Exclude the current entity
      AND r.rating >= 4  -- Quality filter for network recommendations
      AND r.visibility = 'public'
      AND r.user_id IN (
        -- Users that current user follows
        SELECT following_id 
        FROM follows 
        WHERE follower_id = p_current_user_id
      )
    ORDER BY 
      is_mutual DESC,  -- Prioritize mutual connections
      r.rating DESC,   -- Then by rating
      r.created_at DESC -- Then by recency
  ),
  entity_stats AS (
    SELECT 
      r.entity_id,
      AVG(r.rating) as avg_rating,
      COUNT(*) as rec_count,
      MAX(r.created_at) as latest_rec_date
    FROM recommendations r
    WHERE r.entity_id IN (SELECT entity_id FROM network_recommendations)
      AND r.rating >= 3  -- Include all ratings for average calculation
      AND r.visibility = 'public'
    GROUP BY r.entity_id
  )
  SELECT 
    e.id as entity_id,
    e.name as entity_name,
    e.type as entity_type,
    e.image_url as entity_image_url,
    e.slug as entity_slug,
    ROUND(es.avg_rating, 1) as average_rating,
    es.rec_count::integer as recommendation_count,
    nr.recommender_id,
    nr.recommender_username,
    nr.recommender_avatar_url,
    nr.is_mutual as is_mutual_connection,
    nr.recommendation_date as latest_recommendation_date
  FROM network_recommendations nr
  JOIN entities e ON nr.entity_id = e.id
  JOIN entity_stats es ON e.id = es.entity_id
  WHERE e.is_deleted = false
  ORDER BY 
    nr.is_mutual DESC,  -- Mutual connections first
    nr.rating DESC,     -- Then by recommendation rating
    es.avg_rating DESC, -- Then by entity's average rating
    nr.recommendation_date DESC -- Finally by recency
  LIMIT p_limit;
END;
$function$;

-- Create function to get fallback entity recommendations
-- This function returns trending/popular entities when network recommendations are insufficient
CREATE OR REPLACE FUNCTION public.get_fallback_entity_recommendations(
  p_entity_id uuid,
  p_current_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 6
)
RETURNS TABLE(
  entity_id uuid,
  entity_name text,
  entity_type entity_type,
  entity_image_url text,
  entity_slug text,
  average_rating numeric,
  recommendation_count integer,
  trending_score double precision,
  popularity_score double precision,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_entity_type entity_type;
  current_entity_category_id uuid;
BEGIN
  -- Get current entity's type and category for better recommendations
  SELECT e.type, e.category_id 
  INTO current_entity_type, current_entity_category_id
  FROM entities e 
  WHERE e.id = p_entity_id;

  RETURN QUERY
  WITH entity_stats AS (
    SELECT 
      r.entity_id,
      AVG(r.rating) as avg_rating,
      COUNT(*) as rec_count
    FROM recommendations r
    WHERE r.visibility = 'public'
      AND r.entity_id != p_entity_id  -- Exclude current entity
    GROUP BY r.entity_id
    HAVING AVG(r.rating) >= 3.5  -- Quality threshold for fallback
      AND COUNT(*) >= 2  -- Minimum recommendation count
  ),
  filtered_entities AS (
    SELECT 
      e.id,
      e.name,
      e.type,
      e.image_url,
      e.slug,
      e.trending_score,
      e.popularity_score,
      es.avg_rating,
      es.rec_count,
      -- Determine recommendation reason
      CASE 
        WHEN e.type = current_entity_type AND e.category_id = current_entity_category_id THEN 'Similar items in your category'
        WHEN e.type = current_entity_type THEN 'Similar type of item'
        WHEN e.trending_score > 0.7 THEN 'Trending now'
        WHEN e.popularity_score > 0.8 THEN 'Highly rated'
        ELSE 'You might also like'
      END as reason,
      -- Scoring for prioritization
      CASE 
        WHEN e.type = current_entity_type AND e.category_id = current_entity_category_id THEN 3
        WHEN e.type = current_entity_type THEN 2
        ELSE 1
      END as type_score
    FROM entities e
    JOIN entity_stats es ON e.id = es.entity_id
    WHERE e.is_deleted = false
      AND e.id != p_entity_id
      -- Exclude entities user has already recommended
      AND (p_current_user_id IS NULL OR NOT EXISTS(
        SELECT 1 FROM recommendations r2 
        WHERE r2.entity_id = e.id 
        AND r2.user_id = p_current_user_id
      ))
  )
  SELECT 
    fe.id as entity_id,
    fe.name as entity_name,
    fe.type as entity_type,
    fe.image_url as entity_image_url,
    fe.slug as entity_slug,
    ROUND(fe.avg_rating, 1) as average_rating,
    fe.rec_count::integer as recommendation_count,
    COALESCE(fe.trending_score, 0) as trending_score,
    COALESCE(fe.popularity_score, 0) as popularity_score,
    fe.reason
  FROM filtered_entities fe
  ORDER BY 
    fe.type_score DESC,  -- Prioritize same type/category
    fe.avg_rating DESC,  -- Then by rating
    COALESCE(fe.trending_score, 0) DESC,  -- Then by trending
    fe.rec_count DESC    -- Finally by popularity
  LIMIT p_limit;
END;
$function$;

-- Create performance indexes for the recommendation queries
CREATE INDEX IF NOT EXISTS idx_recommendations_user_rating_visibility 
ON recommendations(user_id, rating, visibility) 
WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_recommendations_entity_rating_visibility 
ON recommendations(entity_id, rating, visibility) 
WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_recommendations_entity_created_at 
ON recommendations(entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follows_follower_following 
ON follows(follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_entities_type_category_deleted 
ON entities(type, category_id, is_deleted) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_entities_trending_popularity 
ON entities(trending_score DESC, popularity_score DESC) 
WHERE is_deleted = false;

-- Add helpful function to check network recommendation availability
CREATE OR REPLACE FUNCTION public.has_network_recommendations(
  p_entity_id uuid,
  p_current_user_id uuid,
  p_min_following integer DEFAULT 3,
  p_min_recommendations integer DEFAULT 2
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  following_count integer;
  network_rec_count integer;
BEGIN
  -- Check if user follows enough people
  SELECT COUNT(*) INTO following_count
  FROM follows 
  WHERE follower_id = p_current_user_id;
  
  IF following_count < p_min_following THEN
    RETURN false;
  END IF;
  
  -- Check if there are enough network recommendations available
  SELECT COUNT(DISTINCT r.entity_id) INTO network_rec_count
  FROM recommendations r
  WHERE r.entity_id != p_entity_id
    AND r.rating >= 4
    AND r.visibility = 'public'
    AND r.user_id IN (
      SELECT following_id 
      FROM follows 
      WHERE follower_id = p_current_user_id
    );
  
  RETURN network_rec_count >= p_min_recommendations;
END;
$function$;