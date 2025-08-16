-- Fix the get_who_to_follow function to resolve column ambiguity
CREATE OR REPLACE FUNCTION public.get_who_to_follow(p_user_id uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, username text, avatar_url text, reason text, source text, score double precision, mutuals integer, activity_count integer, profile_quality double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_mutuals INTEGER := 0;
  max_activity INTEGER := 0;
  daily_seed INTEGER;
BEGIN
  -- Generate daily seed for stable shuffle
  daily_seed := extract(epoch from date_trunc('day', now()))::INTEGER;
  
  -- Get max values for normalization
  WITH activity_data AS (
    SELECT user_id,
           COUNT(CASE WHEN created_at >= now() - interval '7 days' THEN 1 END) as act7
    FROM (
      SELECT user_id, created_at FROM posts
      UNION ALL
      SELECT user_id, created_at FROM recommendations
    ) a 
    GROUP BY user_id
  ),
  fof_data AS (
    SELECT f2.following_id as candidate_id, COUNT(*) as mutual_count
    FROM follows f1
    JOIN follows f2 ON f1.following_id = f2.follower_id
    WHERE f1.follower_id = p_user_id
      AND f2.following_id != p_user_id
      AND f2.following_id NOT IN (
        SELECT following_id FROM follows WHERE follower_id = p_user_id
      )
    GROUP BY f2.following_id
  )
  SELECT COALESCE(MAX(mutual_count), 1), COALESCE(MAX(act7), 1)
  INTO max_mutuals, max_activity
  FROM fof_data, activity_data;

  RETURN QUERY
  WITH my_follows AS (
    SELECT following_id FROM follows WHERE follower_id = p_user_id
  ),
  
  -- Tier A: Friends of Friends
  friends_of_friends AS (
    SELECT 
      p.id,
      p.username,
      p.avatar_url,
      COUNT(f1.follower_id) as mutual_count,
      0 as activity_7d,
      'fof'::TEXT as source
    FROM profiles p
    JOIN follows f2 ON f2.following_id = p.id
    JOIN follows f1 ON f1.following_id = f2.follower_id
    WHERE f1.follower_id = p_user_id
      AND p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM my_follows)
      AND p.username IS NOT NULL
      -- Cooldown filter
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '7 days'
      )
    GROUP BY p.id, p.username, p.avatar_url
  ),
  
  -- Tier B: Active Creators
  active_creators AS (
    SELECT DISTINCT
      p.id,
      p.username,
      p.avatar_url,
      0 as mutual_count,
      COUNT(a.user_id) as activity_7d,
      'active'::TEXT as source
    FROM profiles p
    JOIN (
      SELECT user_id, created_at FROM posts WHERE created_at >= now() - interval '7 days'
      UNION ALL
      SELECT user_id, created_at FROM recommendations WHERE created_at >= now() - interval '7 days'
    ) a ON a.user_id = p.id
    WHERE p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM my_follows)
      AND p.id NOT IN (SELECT id FROM friends_of_friends)
      AND p.username IS NOT NULL
      -- Cooldown filter
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '7 days'
      )
    GROUP BY p.id, p.username, p.avatar_url
    HAVING COUNT(a.user_id) > 0
  ),
  
  -- Tier C: Fresh Creators
  fresh_creators AS (
    SELECT 
      p.id,
      p.username,
      p.avatar_url,
      0 as mutual_count,
      0 as activity_7d,
      'fresh'::TEXT as source
    FROM profiles p
    WHERE p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM my_follows)
      AND p.id NOT IN (SELECT id FROM friends_of_friends)
      AND p.id NOT IN (SELECT id FROM active_creators)
      AND p.username IS NOT NULL
      AND p.created_at >= now() - interval '14 days'
      -- Cooldown filter
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '7 days'
      )
  ),
  
  -- Union all tiers
  all_candidates AS (
    SELECT * FROM friends_of_friends
    UNION ALL
    SELECT * FROM active_creators
    UNION ALL
    SELECT * FROM fresh_creators
  ),
  
  -- Calculate scores and generate reasons
  scored_candidates AS (
    SELECT 
      c.id,
      c.username,
      c.avatar_url,
      c.source,
      c.mutual_count,
      c.activity_7d,
      -- Profile quality score
      (
        CASE WHEN c.username IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN c.avatar_url IS NOT NULL THEN 1 ELSE 0 END
      )::DOUBLE PRECISION / 2.0 as profile_quality,
      -- Final score calculation
      (
        0.6 * (c.mutual_count::DOUBLE PRECISION / max_mutuals) +
        0.3 * (c.activity_7d::DOUBLE PRECISION / max_activity) +
        0.1 * (
          CASE WHEN c.username IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN c.avatar_url IS NOT NULL THEN 1 ELSE 0 END
        )::DOUBLE PRECISION / 2.0
      ) as calculated_score,
      -- Generate reason strings
      CASE 
        WHEN c.source = 'fof' AND c.mutual_count > 1 THEN 
          'Followed by ' || c.mutual_count || ' people you follow'
        WHEN c.source = 'fof' AND c.mutual_count = 1 THEN 
          'Followed by someone you follow'
        WHEN c.source = 'active' THEN 
          'Popular this week'
        WHEN c.source = 'fresh' THEN 
          'New on Common Groundz'
        ELSE 'Suggested for you'
      END as reason
    FROM all_candidates c
  )
  
  SELECT 
    sc.id,
    sc.username,
    sc.avatar_url,
    sc.reason,
    sc.source,
    sc.calculated_score as score,
    sc.mutual_count as mutuals,
    sc.activity_7d as activity_count,
    sc.profile_quality
  FROM scored_candidates sc
  ORDER BY 
    sc.calculated_score DESC,
    -- Daily stable shuffle as tiebreaker
    (hashtext(sc.id::TEXT || daily_seed::TEXT))
  LIMIT p_limit;
END;
$function$;