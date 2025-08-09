-- Create function to insert user mentions
CREATE OR REPLACE FUNCTION public.insert_user_mention(post_id uuid, mentioned_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.post_user_mentions (post_id, mentioned_user_id)
  VALUES (post_id, mentioned_user_id);
END;
$function$;