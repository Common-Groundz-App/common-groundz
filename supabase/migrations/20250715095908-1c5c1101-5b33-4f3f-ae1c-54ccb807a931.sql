-- Create function to get entity follower names with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_entity_follower_names(input_entity_id uuid, follower_limit integer DEFAULT 3)
RETURNS TABLE(
  id uuid,
  username text,
  first_name text,
  last_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.first_name,
    p.last_name,
    p.avatar_url
  FROM public.entity_follows ef
  JOIN public.profiles p ON ef.user_id = p.id
  WHERE ef.entity_id = input_entity_id
  ORDER BY ef.created_at DESC
  LIMIT follower_limit;
END;
$function$;