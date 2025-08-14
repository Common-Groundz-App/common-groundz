-- Create the calculate_trending_hashtags RPC function
CREATE OR REPLACE FUNCTION public.calculate_trending_hashtags(time_window_hours integer DEFAULT 72, result_limit integer DEFAULT 10)
 RETURNS TABLE(
   id uuid,
   name_original text,
   name_norm text,
   post_count bigint,
   trending_score double precision,
   created_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cutoff_time timestamp with time zone;
BEGIN
  -- Calculate the cutoff time for trending analysis
  cutoff_time := now() - (time_window_hours || ' hours')::interval;
  
  RETURN QUERY
  WITH hashtag_stats AS (
    SELECT 
      h.id,
      h.name_original,
      h.name_norm,
      h.created_at,
      COUNT(ph.post_id) as total_posts,
      COUNT(CASE WHEN p.created_at > cutoff_time THEN 1 END) as recent_posts,
      COALESCE(AVG(CASE WHEN p.created_at > cutoff_time THEN 1.0 ELSE 0.0 END), 0) as recency_factor
    FROM hashtags h
    LEFT JOIN post_hashtags ph ON h.id = ph.hashtag_id
    LEFT JOIN posts p ON ph.post_id = p.id AND p.is_deleted = false AND p.visibility = 'public'
    GROUP BY h.id, h.name_original, h.name_norm, h.created_at
    HAVING COUNT(ph.post_id) > 0  -- Only include hashtags that have posts
  ),
  scored_hashtags AS (
    SELECT 
      hs.*,
      -- Calculate trending score with time decay
      (hs.recent_posts::double precision * 0.7 + 
       hs.total_posts::double precision * 0.3) * 
       (1.0 + hs.recency_factor * 0.5) as calculated_trending_score
    FROM hashtag_stats hs
  )
  SELECT 
    sh.id,
    sh.name_original,
    sh.name_norm,
    sh.total_posts,
    sh.calculated_trending_score,
    sh.created_at
  FROM scored_hashtags sh
  ORDER BY sh.calculated_trending_score DESC, sh.total_posts DESC
  LIMIT result_limit;
END;
$function$;