CREATE OR REPLACE FUNCTION public.get_profile_mutual_connections(
  viewer_id uuid,
  profile_user_id uuid,
  result_limit int DEFAULT 3
)
RETURNS TABLE(
  id uuid,
  username text,
  first_name text,
  avatar_url text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
  WITH matching_mutuals AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      p.username,
      p.first_name,
      p.avatar_url,
      f1.created_at AS follow_date
    FROM follows f1
    JOIN follows f2 ON f1.following_id = f2.follower_id
    JOIN profiles p ON p.id = f1.following_id
    WHERE f1.follower_id = viewer_id
      AND f2.following_id = profile_user_id
      AND f1.following_id != viewer_id
      AND f1.following_id != profile_user_id
  )
  SELECT
    m.id,
    m.username,
    m.first_name,
    m.avatar_url,
    (SELECT count(*) FROM matching_mutuals) AS total_count
  FROM matching_mutuals m
  ORDER BY m.follow_date DESC
  LIMIT result_limit;
$$;