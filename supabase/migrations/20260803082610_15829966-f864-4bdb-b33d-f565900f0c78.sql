ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS likes_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_likes_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comments_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS replies_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mentions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follows_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.notification_allowed(_user_id uuid, _category text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.notification_preferences;
  found_row boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO p
  FROM public.notification_preferences
  WHERE user_id = _user_id
  LIMIT 1;

  found_row := (p.user_id IS NOT NULL);

  CASE _category
    WHEN 'likes' THEN
      RETURN CASE WHEN found_row THEN p.likes_enabled ELSE true END;
    WHEN 'comment_likes' THEN
      RETURN CASE WHEN found_row THEN p.comment_likes_enabled ELSE true END;
    WHEN 'comments' THEN
      RETURN CASE WHEN found_row THEN p.comments_enabled ELSE true END;
    WHEN 'replies' THEN
      RETURN CASE WHEN found_row THEN p.replies_enabled ELSE true END;
    WHEN 'mentions' THEN
      RETURN CASE WHEN found_row THEN p.mentions_enabled ELSE true END;
    WHEN 'follows' THEN
      RETURN CASE WHEN found_row THEN p.follows_enabled ELSE true END;
    WHEN 'journey' THEN
      RETURN CASE WHEN found_row THEN p.journey_notifications_enabled ELSE true END;
    WHEN 'weekly_digest' THEN
      RETURN CASE WHEN found_row THEN p.weekly_digest_enabled ELSE false END;
    ELSE
      RAISE WARNING 'notification_allowed: unknown category %', _category;
      RETURN false;
  END CASE;
END;
$function$;

REVOKE ALL ON FUNCTION public.notification_allowed(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.notification_allowed(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.notification_allowed(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notification_allowed(uuid, text) TO service_role;