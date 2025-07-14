-- Create function to get entity followers count with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_entity_followers_count(input_entity_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.entity_follows
    WHERE public.entity_follows.entity_id = input_entity_id
  );
END;
$function$;