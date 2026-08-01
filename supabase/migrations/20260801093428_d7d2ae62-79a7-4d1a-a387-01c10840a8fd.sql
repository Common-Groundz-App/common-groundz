-- =====================================================================
-- Phase 2.5 — Reversible notification lifecycle (retraction)
-- Single transactional migration: column, backfill, dedupe, gate,
-- indexes, triggers, RPCs, retention.
-- =====================================================================

-- 1. Column ------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS retracted_at timestamptz NULL;

-- 2. Backfill: retract like/follow rows whose source row is gone -------
UPDATE public.notifications n
   SET retracted_at = now(), updated_at = now()
 WHERE n.retracted_at IS NULL
   AND n.type = 'like'
   AND (n.metadata->>'comment_id') IS NULL
   AND n.entity_type = 'post'
   AND n.sender_id IS NOT NULL
   AND n.entity_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.post_likes pl
      WHERE pl.post_id = n.entity_id AND pl.user_id = n.sender_id
   );

UPDATE public.notifications n
   SET retracted_at = now(), updated_at = now()
 WHERE n.retracted_at IS NULL
   AND n.type = 'like'
   AND (n.metadata->>'comment_id') IS NULL
   AND n.entity_type = 'recommendation'
   AND n.sender_id IS NOT NULL
   AND n.entity_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.recommendation_likes rl
      WHERE rl.recommendation_id = n.entity_id AND rl.user_id = n.sender_id
   );

UPDATE public.notifications n
   SET retracted_at = now(), updated_at = now()
 WHERE n.retracted_at IS NULL
   AND n.type = 'follow'
   AND n.sender_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.follows f
      WHERE f.following_id = n.user_id AND f.follower_id = n.sender_id
   );

-- 3. Retract older duplicates per active identity, keeping the newest --
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, sender_id, entity_type, entity_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
    FROM public.notifications
   WHERE retracted_at IS NULL
     AND type = 'like'
     AND (metadata->>'comment_id') IS NULL
     AND sender_id IS NOT NULL
     AND entity_id IS NOT NULL
     AND entity_type IS NOT NULL
)
UPDATE public.notifications n
   SET retracted_at = now(), updated_at = now()
  FROM ranked r
 WHERE n.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, sender_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
    FROM public.notifications
   WHERE retracted_at IS NULL
     AND type = 'follow'
     AND sender_id IS NOT NULL
)
UPDATE public.notifications n
   SET retracted_at = now(), updated_at = now()
  FROM ranked r
 WHERE n.id = r.id AND r.rn > 1;

-- 4. Gate: abort loudly if any duplicate active identity remains ------
DO $$
DECLARE
  dup_likes bigint;
  dup_follows bigint;
BEGIN
  SELECT count(*) INTO dup_likes FROM (
    SELECT 1 FROM public.notifications
     WHERE retracted_at IS NULL AND type = 'like'
       AND (metadata->>'comment_id') IS NULL
       AND sender_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type IS NOT NULL
     GROUP BY user_id, sender_id, entity_type, entity_id
     HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO dup_follows FROM (
    SELECT 1 FROM public.notifications
     WHERE retracted_at IS NULL AND type = 'follow' AND sender_id IS NOT NULL
     GROUP BY user_id, sender_id
     HAVING count(*) > 1
  ) d;

  IF dup_likes > 0 OR dup_follows > 0 THEN
    RAISE EXCEPTION
      'Phase 2.5 aborted: % duplicate active like identities, % duplicate active follow identities remain',
      dup_likes, dup_follows;
  END IF;
END $$;

-- 5. Indexes ----------------------------------------------------------
-- Top-level content likes only. Comment likes carry metadata.comment_id and
-- share the parent entity_id, so including them would let a post like and a
-- comment like from the same actor collide.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_content_like_notifications
  ON public.notifications (user_id, sender_id, entity_type, entity_id)
  WHERE retracted_at IS NULL AND type = 'like'
    AND (metadata->>'comment_id') IS NULL
    AND sender_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_follow_notifications
  ON public.notifications (user_id, sender_id)
  WHERE retracted_at IS NULL AND type = 'follow' AND sender_id IS NOT NULL;

-- Active-only keyset indexes so tombstones never slow live reads.
CREATE INDEX IF NOT EXISTS idx_notifications_active_keyset
  ON public.notifications (user_id, created_at DESC, id DESC)
  WHERE retracted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_active_unread_keyset
  ON public.notifications (user_id, created_at DESC, id DESC)
  WHERE retracted_at IS NULL AND is_read = false;

-- Deterministic prune batch selection.
CREATE INDEX IF NOT EXISTS idx_notifications_retracted_prune
  ON public.notifications (retracted_at, id)
  WHERE retracted_at IS NOT NULL;

-- 6. Insert triggers: targeted idempotency ----------------------------
CREATE OR REPLACE FUNCTION public.create_post_like_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  post_owner_id UUID;
  post_title TEXT;
BEGIN
  SELECT user_id, COALESCE(title, 'your post') INTO post_owner_id, post_title
  FROM public.posts WHERE id = NEW.post_id;

  IF post_owner_id IS NULL OR post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, sender_id, title, message, entity_type, entity_id, image_url, action_url
  )
  VALUES (
    post_owner_id,
    'like',
    NEW.user_id,
    'New like',
    (SELECT username FROM public.profiles WHERE id = NEW.user_id) || ' liked ' || post_title,
    'post',
    NEW.post_id,
    (SELECT avatar_url FROM public.profiles WHERE id = NEW.user_id),
    '/post/' || NEW.post_id
  )
  -- Targeted at uniq_active_content_like_notifications only. A bare
  -- ON CONFLICT DO NOTHING would also swallow a PK collision or any future
  -- unique rule; if the index predicate changes, this fails loudly instead.
  ON CONFLICT (user_id, sender_id, entity_type, entity_id)
    WHERE retracted_at IS NULL AND type = 'like'
      AND (metadata->>'comment_id') IS NULL
      AND sender_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_recommendation_like_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec_owner_id UUID;
  rec_title TEXT;
BEGIN
  SELECT user_id, title INTO rec_owner_id, rec_title
  FROM public.recommendations WHERE id = NEW.recommendation_id;

  IF rec_owner_id IS NULL OR rec_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, sender_id, title, message, entity_type, entity_id, image_url, action_url
  )
  VALUES (
    rec_owner_id,
    'like',
    NEW.user_id,
    'New like',
    (SELECT username FROM public.profiles WHERE id = NEW.user_id) || ' liked your recommendation for ' || rec_title,
    'recommendation',
    NEW.recommendation_id,
    (SELECT avatar_url FROM public.profiles WHERE id = NEW.user_id),
    '/recommendations/' || NEW.recommendation_id
  )
  ON CONFLICT (user_id, sender_id, entity_type, entity_id)
    WHERE retracted_at IS NULL AND type = 'like'
      AND (metadata->>'comment_id') IS NULL
      AND sender_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_follow_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (
    user_id, type, sender_id, title, message, entity_type, entity_id, image_url, action_url
  )
  VALUES (
    NEW.following_id,
    'follow',
    NEW.follower_id,
    'New follower',
    (SELECT username FROM public.profiles WHERE id = NEW.follower_id) || ' started following you',
    'profile',
    NEW.follower_id,
    (SELECT avatar_url FROM public.profiles WHERE id = NEW.follower_id),
    '/profile/' || NEW.follower_id
  )
  ON CONFLICT (user_id, sender_id)
    WHERE retracted_at IS NULL AND type = 'follow' AND sender_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 7. Retraction triggers (undo) ---------------------------------------
CREATE OR REPLACE FUNCTION public.retract_post_like_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  post_owner_id UUID;
BEGIN
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = OLD.post_id;
  IF post_owner_id IS NULL THEN
    RETURN OLD;
  END IF;

  UPDATE public.notifications
     SET retracted_at = now(), updated_at = now()
   WHERE retracted_at IS NULL
     AND type = 'like'
     AND (metadata->>'comment_id') IS NULL
     AND user_id = post_owner_id
     AND sender_id = OLD.user_id
     AND entity_type = 'post'
     AND entity_id = OLD.post_id;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.retract_recommendation_like_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec_owner_id UUID;
BEGIN
  SELECT user_id INTO rec_owner_id FROM public.recommendations WHERE id = OLD.recommendation_id;
  IF rec_owner_id IS NULL THEN
    RETURN OLD;
  END IF;

  UPDATE public.notifications
     SET retracted_at = now(), updated_at = now()
   WHERE retracted_at IS NULL
     AND type = 'like'
     AND (metadata->>'comment_id') IS NULL
     AND user_id = rec_owner_id
     AND sender_id = OLD.user_id
     AND entity_type = 'recommendation'
     AND entity_id = OLD.recommendation_id;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.retract_follow_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.notifications
     SET retracted_at = now(), updated_at = now()
   WHERE retracted_at IS NULL
     AND type = 'follow'
     AND user_id = OLD.following_id
     AND sender_id = OLD.follower_id;

  RETURN OLD;
END;
$function$;

-- Comment soft-delete privacy cleanup. `mention` is not a notification type:
-- mentions are type='comment' with metadata.event='mention'. System and
-- moderation rows referencing the same comment are deliberately left alone.
CREATE OR REPLACE FUNCTION public.retract_comment_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.notifications
     SET retracted_at = now(), updated_at = now()
   WHERE retracted_at IS NULL
     AND type IN ('comment', 'like')
     AND (metadata->>'comment_id') = NEW.id::text;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_delete_post_like ON public.post_likes;
CREATE TRIGGER on_delete_post_like
  AFTER DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.retract_post_like_notification();

DROP TRIGGER IF EXISTS on_delete_recommendation_like ON public.recommendation_likes;
CREATE TRIGGER on_delete_recommendation_like
  AFTER DELETE ON public.recommendation_likes
  FOR EACH ROW EXECUTE FUNCTION public.retract_recommendation_like_notification();

DROP TRIGGER IF EXISTS on_delete_follow ON public.follows;
CREATE TRIGGER on_delete_follow
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.retract_follow_notification();

DROP TRIGGER IF EXISTS on_soft_delete_post_comment ON public.post_comments;
CREATE TRIGGER on_soft_delete_post_comment
  AFTER UPDATE ON public.post_comments
  FOR EACH ROW
  WHEN (OLD.is_deleted IS DISTINCT FROM TRUE AND NEW.is_deleted = TRUE)
  EXECUTE FUNCTION public.retract_comment_notifications();

DROP TRIGGER IF EXISTS on_soft_delete_recommendation_comment ON public.recommendation_comments;
CREATE TRIGGER on_soft_delete_recommendation_comment
  AFTER UPDATE ON public.recommendation_comments
  FOR EACH ROW
  WHEN (OLD.is_deleted IS DISTINCT FROM TRUE AND NEW.is_deleted = TRUE)
  EXECUTE FUNCTION public.retract_comment_notifications();

-- 8. RPCs ignore retracted rows ---------------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT count(*)::bigint
  FROM public.notifications
  WHERE user_id = auth.uid()
    AND is_read = false
    AND retracted_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  affected bigint;
BEGIN
  UPDATE public.notifications
     SET is_read = true,
         updated_at = now()
   WHERE user_id = auth.uid()
     AND is_read = false
     AND retracted_at IS NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$function$;

-- 9. Bounded retention -------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_retracted_notifications(p_limit int DEFAULT 5000)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted bigint;
BEGIN
  WITH batch AS (
    SELECT id FROM public.notifications
     WHERE retracted_at IS NOT NULL
       AND retracted_at < now() - interval '60 days'
     ORDER BY retracted_at, id
     LIMIT GREATEST(p_limit, 0)
  )
  DELETE FROM public.notifications n
   USING batch b
   WHERE n.id = b.id;

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_retracted_notifications(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_retracted_notifications(int) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-retracted-notifications') THEN
      PERFORM cron.unschedule('prune-retracted-notifications');
    END IF;
    PERFORM cron.schedule(
      'prune-retracted-notifications',
      '17 3 * * *',
      $cron$ SELECT public.prune_retracted_notifications(5000); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed; skipping retention schedule (retention is not a correctness dependency)';
  END IF;
END $$;