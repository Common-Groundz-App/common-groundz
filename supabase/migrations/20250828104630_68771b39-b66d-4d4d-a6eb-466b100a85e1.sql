-- Fix circle rating calculation to use latest timeline ratings
DROP FUNCTION IF EXISTS public.get_circle_rating(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_circle_rating(p_entity_id uuid, p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  avg_rating DECIMAL(2,1);
BEGIN
  SELECT ROUND(AVG(COALESCE(r.latest_rating, r.rating)), 1) INTO avg_rating
  FROM public.reviews r
  WHERE r.entity_id = p_entity_id
    AND r.status = 'published'
    AND r.user_id IN (
      SELECT following_id 
      FROM public.follows 
      WHERE follower_id = p_user_id
    );
  
  RETURN COALESCE(avg_rating, 0.0);
END;
$function$;