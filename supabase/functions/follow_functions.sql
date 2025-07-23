
-- Update the RPC functions to properly handle authentication context

CREATE OR REPLACE FUNCTION public.get_followers_with_profiles(profile_user_id uuid, current_user_id uuid)
 RETURNS TABLE(id uuid, username text, avatar_url text, "isFollowing" boolean)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    CASE 
      WHEN current_user_id IS NOT NULL THEN
        EXISTS (
          SELECT 1
          FROM public.follows f2
          WHERE f2.follower_id = current_user_id
          AND f2.following_id = p.id
        )
      ELSE false
    END AS "isFollowing"
  FROM
    public.follows f
  JOIN
    public.profiles p ON f.follower_id = p.id
  WHERE
    f.following_id = profile_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_following_with_profiles(profile_user_id uuid, current_user_id uuid)
 RETURNS TABLE(id uuid, username text, avatar_url text, "isFollowing" boolean)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    CASE 
      WHEN current_user_id IS NOT NULL THEN
        EXISTS (
          SELECT 1
          FROM public.follows f2
          WHERE f2.follower_id = current_user_id
          AND f2.following_id = p.id
        )
      ELSE false
    END AS "isFollowing"
  FROM
    public.follows f
  JOIN
    public.profiles p ON f.following_id = p.id
  WHERE
    f.follower_id = profile_user_id;
END;
$function$;
