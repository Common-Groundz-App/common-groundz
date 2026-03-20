
-- New batch RPC for Explore: returns up to 2 mutual preview rows per target user
-- with avatar/name data + total count, using SECURITY DEFINER to bypass follows RLS

CREATE OR REPLACE FUNCTION public.get_batch_mutual_previews(
  viewer_id uuid,
  target_user_ids uuid[]
)
RETURNS TABLE(
  target_user_id uuid,
  mutual_user_id uuid,
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
  WITH mutual_edges AS (
    SELECT
      f2.following_id AS target_user_id,
      f1.following_id AS mutual_user_id,
      f1.created_at AS follow_date
    FROM public.follows f1
    JOIN public.follows f2 ON f1.following_id = f2.follower_id
    WHERE f1.follower_id = viewer_id
      AND f2.following_id = ANY(target_user_ids)
      AND f1.following_id != viewer_id
  ),
  mutual_counts AS (
    SELECT target_user_id, count(*) AS total_count
    FROM mutual_edges
    GROUP BY target_user_id
  ),
  ranked AS (
    SELECT
      me.target_user_id,
      me.mutual_user_id,
      me.follow_date,
      ROW_NUMBER() OVER (PARTITION BY me.target_user_id ORDER BY me.follow_date DESC) AS rn
    FROM mutual_edges me
  )
  SELECT
    r.target_user_id,
    r.mutual_user_id,
    p.username,
    p.first_name,
    p.avatar_url,
    mc.total_count
  FROM ranked r
  JOIN public.profiles p ON p.id = r.mutual_user_id
  JOIN mutual_counts mc ON mc.target_user_id = r.target_user_id
  WHERE r.rn <= 2;
$$;

REVOKE EXECUTE ON FUNCTION public.get_batch_mutual_previews(uuid, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_batch_mutual_previews(uuid, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_batch_mutual_previews(uuid, uuid[]) TO authenticated;
