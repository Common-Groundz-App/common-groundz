
CREATE OR REPLACE FUNCTION public.count_comments_by_recommendation(recommendation_ids uuid[])
RETURNS TABLE (recommendation_id uuid, count bigint) 
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT 
    recommendation_id,
    COUNT(*) as count
  FROM 
    recommendation_comments
  WHERE 
    recommendation_id = ANY(recommendation_ids)
    AND is_deleted = false
  GROUP BY 
    recommendation_id;
$$;
