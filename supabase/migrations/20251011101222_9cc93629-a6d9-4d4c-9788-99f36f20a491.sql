-- Create batched RPC function for timeline-aware recommendation counts
CREATE OR REPLACE FUNCTION public.get_recommendation_counts_batch(p_entity_ids uuid[])
RETURNS TABLE(entity_id uuid, recommendation_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.entity_id,
    COUNT(*)::INTEGER as recommendation_count
  FROM public.reviews r
  WHERE r.entity_id = ANY(p_entity_ids)
    AND r.is_recommended = true
    AND r.status = 'published'
  GROUP BY r.entity_id;
END;
$$;

-- Grant execute to authenticated and anon users (Explore page is public)
GRANT EXECUTE ON FUNCTION public.get_recommendation_counts_batch(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recommendation_counts_batch(uuid[]) TO anon;

-- Create batched RPC function for circle recommendation counts
CREATE OR REPLACE FUNCTION public.get_circle_recommendation_counts_batch(
  p_entity_ids uuid[],
  p_user_id uuid
)
RETURNS TABLE(entity_id uuid, circle_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.entity_id,
    COUNT(*)::INTEGER as circle_count
  FROM public.reviews r
  WHERE r.entity_id = ANY(p_entity_ids)
    AND r.is_recommended = true
    AND r.status = 'published'
    AND r.user_id IN (
      SELECT following_id 
      FROM public.follows 
      WHERE follower_id = p_user_id
    )
  GROUP BY r.entity_id;
END;
$$;

-- Grant execute to authenticated users only (requires user context)
GRANT EXECUTE ON FUNCTION public.get_circle_recommendation_counts_batch(uuid[], uuid) TO authenticated;