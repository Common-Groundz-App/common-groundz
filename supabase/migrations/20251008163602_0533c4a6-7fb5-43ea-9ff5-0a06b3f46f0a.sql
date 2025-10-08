-- Create function to get child entities with their review ratings
CREATE OR REPLACE FUNCTION public.get_child_entities_with_ratings(parent_uuid uuid)
RETURNS TABLE(
  id uuid,
  name text,
  type entity_type,
  image_url text,
  description text,
  slug text,
  venue text,
  specifications jsonb,
  price_info jsonb,
  average_rating numeric,
  review_count bigint,
  latest_review_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.type,
    e.image_url,
    e.description,
    e.slug,
    e.venue,
    e.specifications,
    e.price_info,
    ROUND(AVG(r.rating), 1) as average_rating,
    COUNT(r.id) as review_count,
    MAX(r.created_at) as latest_review_date
  FROM public.entities e
  LEFT JOIN public.reviews r ON e.id = r.entity_id AND r.status = 'published'
  WHERE e.parent_id = parent_uuid 
    AND e.is_deleted = false
  GROUP BY e.id, e.name, e.type, e.image_url, e.description, e.slug, e.venue, e.specifications, e.price_info
  ORDER BY 
    average_rating DESC NULLS LAST,
    review_count DESC,
    latest_review_date DESC NULLS LAST;
END;
$function$;