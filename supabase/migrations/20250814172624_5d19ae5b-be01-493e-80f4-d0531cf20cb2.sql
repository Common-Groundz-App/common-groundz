-- Fix duplicate function issue by dropping and recreating the function
DROP FUNCTION IF EXISTS calculate_trending_hashtags(integer);
DROP FUNCTION IF EXISTS calculate_trending_hashtags(bigint);

-- Create the correct trending hashtags function
CREATE OR REPLACE FUNCTION calculate_trending_hashtags(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  name_original text,
  name_norm text,
  post_count bigint,
  created_at timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.name_original,
    h.name_norm,
    COUNT(ph.post_id) as post_count,
    h.created_at
  FROM hashtags h
  LEFT JOIN post_hashtags ph ON h.id = ph.hashtag_id
  LEFT JOIN posts p ON ph.post_id = p.id
  WHERE p.is_deleted = false OR p.id IS NULL
  GROUP BY h.id, h.name_original, h.name_norm, h.created_at
  ORDER BY post_count DESC, h.created_at DESC
  LIMIT p_limit;
END;
$$;