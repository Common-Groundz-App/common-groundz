-- Composite index for the head query and every keyset page
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC, id DESC);

-- Global unread count for the current user
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT count(*)::bigint
  FROM public.notifications
  WHERE user_id = auth.uid()
    AND is_read = false;
$$;

REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

-- Server-side mark-all-as-read for the current user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  affected bigint;
BEGIN
  UPDATE public.notifications
     SET is_read = true,
         updated_at = now()
   WHERE user_id = auth.uid()
     AND is_read = false;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_as_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_as_read() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_as_read() TO authenticated;