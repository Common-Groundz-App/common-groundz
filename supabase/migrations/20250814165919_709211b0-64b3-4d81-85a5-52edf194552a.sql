-- Create the missing calculate_trending_hashtags RPC function
CREATE OR REPLACE FUNCTION public.calculate_trending_hashtags(trending_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  name_original text,
  name_norm text,
  created_at timestamp with time zone,
  post_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.name_original,
    h.name_norm,
    h.created_at,
    COUNT(ph.hashtag_id) as post_count
  FROM public.hashtags h
  LEFT JOIN public.post_hashtags ph ON h.id = ph.hashtag_id
  LEFT JOIN public.posts p ON ph.post_id = p.id
  WHERE p.is_deleted = false OR p.id IS NULL
  GROUP BY h.id, h.name_original, h.name_norm, h.created_at
  ORDER BY post_count DESC, h.created_at DESC
  LIMIT trending_limit;
END;
$function$;