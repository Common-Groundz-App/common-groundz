-- Check for existing function overloads
SELECT proname, oidvectortypes(proargtypes) as args, prolang, provolatile
FROM pg_proc 
WHERE proname = 'get_who_to_follow';

-- Drop all existing versions of get_who_to_follow function
DROP FUNCTION IF EXISTS public.get_who_to_follow(uuid, integer);
DROP FUNCTION IF EXISTS public.get_who_to_follow(p_user_id uuid, p_limit integer);

-- Create the new SQL function (not plpgsql) to avoid parameter name conflicts
CREATE OR REPLACE FUNCTION public.get_who_to_follow(p_user_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  reason text,
  source text,
  score double precision,
  mutuals integer,
  activity_count integer,
  profile_quality double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_follows AS (
    SELECT f.following_id 
    FROM follows f 
    WHERE f.follower_id = p_user_id
  ),
  
  friends_of_friends AS (
    SELECT 
      p.id,
      p.username,
      p.avatar_url,
      COUNT(f1.follower_id) as mutual_count,
      0 as activity_7d,
      'fof' as source_type
    FROM profiles p
    JOIN follows f2 ON f2.following_id = p.id
    JOIN follows f1 ON f1.following_id = f2.follower_id
    WHERE f1.follower_id = p_user_id
      AND p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM user_follows)
      AND p.username IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '7 days'
      )
    GROUP BY p.id, p.username, p.avatar_url
  ),
  
  active_creators AS (
    SELECT DISTINCT
      p.id,
      p.username,
      p.avatar_url,
      0 as mutual_count,
      COUNT(activity.user_id) as activity_7d,
      'active' as source_type
    FROM profiles p
    JOIN (
      SELECT user_id, created_at FROM posts WHERE created_at >= now() - interval '7 days'
      UNION ALL
      SELECT user_id, created_at FROM recommendations WHERE created_at >= now() - interval '7 days'
    ) activity ON activity.user_id = p.id
    WHERE p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM user_follows)
      AND p.id NOT IN (SELECT fof.id FROM friends_of_friends fof)
      AND p.username IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '7 days'
      )
    GROUP BY p.id, p.username, p.avatar_url
    HAVING COUNT(activity.user_id) > 0
  ),
  
  fresh_creators AS (
    SELECT 
      p.id,
      p.username,
      p.avatar_url,
      0 as mutual_count,
      0 as activity_7d,
      'fresh' as source_type
    FROM profiles p
    WHERE p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM user_follows)
      AND p.id NOT IN (SELECT fof.id FROM friends_of_friends fof)
      AND p.id NOT IN (SELECT ac.id FROM active_creators ac)
      AND p.username IS NOT NULL
      AND p.created_at >= now() - interval '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '7 days'
      )
  ),
  
  all_candidates AS (
    SELECT * FROM friends_of_friends
    UNION ALL
    SELECT * FROM active_creators
    UNION ALL
    SELECT * FROM fresh_creators
  ),
  
  scored_candidates AS (
    SELECT 
      c.id,
      c.username,
      c.avatar_url,
      c.source_type,
      c.mutual_count,
      c.activity_7d,
      (CASE WHEN c.username IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN c.avatar_url IS NOT NULL THEN 1 ELSE 0 END)::DOUBLE PRECISION / 2.0 as quality_score,
      (0.6 * CASE WHEN c.mutual_count > 0 THEN c.mutual_count::DOUBLE PRECISION / GREATEST(1, c.mutual_count) ELSE 0 END +
       0.3 * CASE WHEN c.activity_7d > 0 THEN c.activity_7d::DOUBLE PRECISION / GREATEST(1, c.activity_7d) ELSE 0 END +
       0.1 * (CASE WHEN c.username IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN c.avatar_url IS NOT NULL THEN 1 ELSE 0 END)::DOUBLE PRECISION / 2.0) as calculated_score,
      CASE 
        WHEN c.source_type = 'fof' AND c.mutual_count > 1 THEN 
          'Followed by ' || c.mutual_count || ' people you follow'
        WHEN c.source_type = 'fof' AND c.mutual_count = 1 THEN 
          'Followed by someone you follow'
        WHEN c.source_type = 'active' THEN 
          'Popular this week'
        WHEN c.source_type = 'fresh' THEN 
          'New on Common Groundz'
        ELSE 'Suggested for you'
      END as reason_text
    FROM all_candidates c
  )
  
  SELECT 
    sc.id as user_id,
    sc.username,
    sc.avatar_url,
    sc.reason_text as reason,
    sc.source_type as source,
    sc.calculated_score as score,
    sc.mutual_count as mutuals,
    sc.activity_7d as activity_count,
    sc.quality_score as profile_quality
  FROM scored_candidates sc
  ORDER BY 
    sc.calculated_score DESC,
    sc.id
  LIMIT p_limit;
$$;