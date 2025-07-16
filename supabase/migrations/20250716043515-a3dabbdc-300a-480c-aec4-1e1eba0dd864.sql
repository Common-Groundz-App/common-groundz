-- Enhanced function to get entity followers with relationship context
CREATE OR REPLACE FUNCTION public.get_entity_followers_with_context(
  input_entity_id uuid,
  current_user_id uuid DEFAULT NULL,
  search_query text DEFAULT NULL,
  relationship_filter text DEFAULT NULL,
  follower_limit integer DEFAULT 50,
  follower_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  is_following boolean,
  is_mutual boolean,
  followed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH follower_context AS (
    SELECT 
      p.id,
      p.username,
      p.first_name,
      p.last_name,
      p.avatar_url,
      ef.created_at as followed_at,
      -- Check if current user follows this follower
      EXISTS(
        SELECT 1 FROM public.follows f1 
        WHERE f1.follower_id = current_user_id 
        AND f1.following_id = p.id
      ) as is_following,
      -- Check if it's a mutual connection
      EXISTS(
        SELECT 1 FROM public.follows f1 
        WHERE f1.follower_id = current_user_id 
        AND f1.following_id = p.id
      ) AND EXISTS(
        SELECT 1 FROM public.follows f2 
        WHERE f2.follower_id = p.id 
        AND f2.following_id = current_user_id
      ) as is_mutual
    FROM public.entity_follows ef
    JOIN public.profiles p ON ef.user_id = p.id
    WHERE ef.entity_id = input_entity_id
  )
  SELECT 
    fc.id,
    fc.username,
    fc.first_name,
    fc.last_name,
    fc.avatar_url,
    fc.is_following,
    fc.is_mutual,
    fc.followed_at
  FROM follower_context fc
  WHERE 
    -- Search filter
    (search_query IS NULL OR 
     LOWER(COALESCE(fc.username, '')) LIKE LOWER('%' || search_query || '%') OR
     LOWER(COALESCE(fc.first_name, '')) LIKE LOWER('%' || search_query || '%') OR
     LOWER(COALESCE(fc.last_name, '')) LIKE LOWER('%' || search_query || '%'))
    -- Relationship filter
    AND (relationship_filter IS NULL OR
         (relationship_filter = 'following' AND fc.is_following = true) OR
         (relationship_filter = 'mutual' AND fc.is_mutual = true) OR
         (relationship_filter = 'all'))
  ORDER BY 
    -- Prioritize people user follows, then mutual connections, then recent followers
    fc.is_following DESC,
    fc.is_mutual DESC,
    fc.followed_at DESC
  LIMIT follower_limit
  OFFSET follower_offset;
END;
$function$