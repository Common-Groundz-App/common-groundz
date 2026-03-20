-- Fix: Change get_profile_mutual_connections from SECURITY INVOKER to SECURITY DEFINER
-- This allows the function to bypass RLS on the follows table to see third-party follow edges

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
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH matching_mutuals AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      p.username,
      p.first_name,
      p.avatar_url,
      f1.created_at AS follow_date
    FROM public.follows f1
    JOIN public.follows f2 ON f1.following_id = f2.follower_id
    JOIN public.profiles p ON p.id = f1.following_id
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

REVOKE EXECUTE ON FUNCTION public.get_profile_mutual_connections(uuid, uuid, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_mutual_connections(uuid, uuid, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_mutual_connections(uuid, uuid, int) TO authenticated;

-- New batch RPC for Explore page mutual counts
CREATE OR REPLACE FUNCTION public.get_batch_mutual_counts(
  viewer_id uuid,
  target_user_ids uuid[]
)
RETURNS TABLE(
  user_id uuid,
  mutual_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    f2.following_id AS user_id,
    count(*) AS mutual_count
  FROM public.follows f1
  JOIN public.follows f2 ON f1.following_id = f2.follower_id
  WHERE f1.follower_id = viewer_id
    AND f2.following_id = ANY(target_user_ids)
    AND f1.following_id != viewer_id
  GROUP BY f2.following_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_batch_mutual_counts(uuid, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_batch_mutual_counts(uuid, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_batch_mutual_counts(uuid, uuid[]) TO authenticated;
