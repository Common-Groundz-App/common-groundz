-- =========================================================
-- Phase 2.5A — Comment lifecycle sync
-- =========================================================

-- ---------------------------------------------------------
-- 1. Repair existing comment-like notification state
-- ---------------------------------------------------------

-- 1a. Retract orphans: active comment-like notifications whose full canonical
--     identity (recipient = comment author, entity_id = parent, entity_type
--     agreement, sender still has an active like) cannot be validated.
WITH candidates AS (
  SELECT
    n.id,
    n.user_id,
    n.sender_id,
    n.entity_id,
    n.entity_type,
    CASE
      WHEN n.metadata->>'comment_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (n.metadata->>'comment_id')::uuid
    END AS comment_id
  FROM public.notifications n
  WHERE n.retracted_at IS NULL
    AND n.type = 'comment'
    AND n.metadata->>'event' = 'like'
),
valid AS (
  SELECT c.id
  FROM candidates c
  JOIN public.comment_likes cl
    ON cl.comment_id = c.comment_id
   AND cl.comment_type = c.entity_type
   AND cl.user_id = c.sender_id
  LEFT JOIN public.post_comments pc
    ON c.entity_type = 'post' AND pc.id = c.comment_id
  LEFT JOIN public.recommendation_comments rc
    ON c.entity_type = 'recommendation' AND rc.id = c.comment_id
  WHERE c.comment_id IS NOT NULL
    AND c.sender_id IS NOT NULL
    AND c.entity_id IS NOT NULL
    AND (
      (c.entity_type = 'post' AND pc.user_id = c.user_id AND pc.post_id = c.entity_id)
      OR
      (c.entity_type = 'recommendation' AND rc.user_id = c.user_id AND rc.recommendation_id = c.entity_id)
    )
)
UPDATE public.notifications n
SET retracted_at = now(), updated_at = now()
WHERE n.id IN (SELECT id FROM candidates)
  AND n.id NOT IN (SELECT id FROM valid);

-- 1b. Deduplicate: keep the NEWEST active row per identity, retract the rest.
WITH ranked AS (
  SELECT
    n.id,
    row_number() OVER (
      PARTITION BY n.user_id, n.sender_id, n.entity_type, n.entity_id, (n.metadata->>'comment_id')
      ORDER BY n.created_at DESC, n.id DESC
    ) AS rn
  FROM public.notifications n
  WHERE n.retracted_at IS NULL
    AND n.type = 'comment'
    AND n.metadata->>'event' = 'like'
)
UPDATE public.notifications n
SET retracted_at = now(), updated_at = now()
WHERE n.id IN (SELECT id FROM ranked WHERE rn > 1);

-- 1c. Assert: fail loudly if any duplicate active group survives.
DO $assert$
DECLARE
  dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT 1
    FROM public.notifications n
    WHERE n.retracted_at IS NULL
      AND n.type = 'comment'
      AND n.metadata->>'event' = 'like'
    GROUP BY n.user_id, n.sender_id, n.entity_type, n.entity_id, (n.metadata->>'comment_id')
    HAVING count(*) > 1
  ) d;

  IF dupes > 0 THEN
    RAISE EXCEPTION 'Phase 2.5A: % duplicate active comment-like notification groups remain', dupes;
  END IF;
END
$assert$;

-- 1d. Constrain active comment-like notifications.
--     NOTE: the column list and predicate below must match the targeted
--     ON CONFLICT clause in toggle_comment_like exactly, or Postgres cannot
--     infer this index.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_comment_like_notifications
  ON public.notifications (user_id, sender_id, entity_type, entity_id, (metadata->>'comment_id'))
  WHERE retracted_at IS NULL
    AND type = 'comment'
    AND metadata->>'event' = 'like';

-- 1e. Fix stale singular /recommendation/ action URLs.
UPDATE public.notifications
SET action_url = '/recommendations/' || substring(action_url from '^/recommendation/(.*)$'),
    updated_at = now()
WHERE action_url LIKE '/recommendation/%';

-- ---------------------------------------------------------
-- 2. toggle_comment_like — retract on unlike, fresh row on re-like
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_comment_like(p_comment_id uuid, p_comment_type text, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_like_id uuid;
  comment_table text;
  comment_author_id uuid;
  liker_username text;
  parent_item_id uuid;
  item_action_url text;
  id_field text;
BEGIN
  IF p_comment_type NOT IN ('post', 'recommendation') THEN
    RAISE EXCEPTION 'Invalid comment type: %', p_comment_type;
  END IF;

  -- Auth guard: prevent user_id spoofing
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_comment_type = 'post' THEN
    comment_table := 'post_comments';
    id_field := 'post_id';
  ELSE
    comment_table := 'recommendation_comments';
    id_field := 'recommendation_id';
  END IF;

  SELECT id INTO existing_like_id
  FROM public.comment_likes
  WHERE comment_id = p_comment_id
    AND comment_type = p_comment_type
    AND user_id = p_user_id;

  IF existing_like_id IS NOT NULL THEN
    DELETE FROM public.comment_likes WHERE id = existing_like_id;

    -- Retract the active like notification (never touches is_read/created_at)
    EXECUTE format('SELECT user_id, %I FROM %I WHERE id = $1', id_field, comment_table)
    INTO comment_author_id, parent_item_id
    USING p_comment_id;

    IF comment_author_id IS NOT NULL THEN
      UPDATE public.notifications n
      SET retracted_at = now(), updated_at = now()
      WHERE n.retracted_at IS NULL
        AND n.type = 'comment'
        AND n.user_id = comment_author_id
        AND n.sender_id = p_user_id
        AND n.entity_type = p_comment_type
        AND n.entity_id = parent_item_id
        AND n.metadata->>'comment_id' = p_comment_id::text
        AND n.metadata->>'event' = 'like';
    END IF;

    RETURN false;
  ELSE
    INSERT INTO public.comment_likes (comment_id, comment_type, user_id)
    VALUES (p_comment_id, p_comment_type, p_user_id);

    EXECUTE format('SELECT user_id, %I FROM %I WHERE id = $1', id_field, comment_table)
    INTO comment_author_id, parent_item_id
    USING p_comment_id;

    IF comment_author_id IS NOT NULL AND comment_author_id <> p_user_id THEN
      SELECT username INTO liker_username
      FROM public.profiles
      WHERE id = p_user_id AND (deleted_at IS NULL);

      liker_username := COALESCE(liker_username, 'Someone');

      IF p_comment_type = 'post' THEN
        item_action_url := '/post/' || parent_item_id::text || '?commentId=' || p_comment_id::text;
      ELSE
        item_action_url := '/recommendations/' || parent_item_id::text || '?commentId=' || p_comment_id::text;
      END IF;

      -- Re-like inserts a FRESH unread row: the guard only considers active rows.
      INSERT INTO public.notifications (user_id, sender_id, type, title, message, entity_id, entity_type, action_url, metadata)
      SELECT
        comment_author_id,
        p_user_id,
        'comment',
        liker_username || ' liked your comment',
        '',
        parent_item_id,
        p_comment_type,
        item_action_url,
        jsonb_build_object('event', 'like', 'comment_id', p_comment_id::text)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = comment_author_id
          AND n.sender_id = p_user_id
          AND n.entity_id = parent_item_id
          AND n.entity_type = p_comment_type
          AND n.metadata->>'comment_id' = p_comment_id::text
          AND n.metadata->>'event' = 'like'
          AND n.retracted_at IS NULL
      )
      ON CONFLICT (user_id, sender_id, entity_type, entity_id, (metadata->>'comment_id'))
        WHERE retracted_at IS NULL
          AND type = 'comment'
          AND metadata->>'event' = 'like'
      DO NOTHING;
    END IF;

    RETURN true;
  END IF;
END;
$function$;

-- ---------------------------------------------------------
-- 3. Enforce the single-writer invariant on comment_likes
--    (verified: no direct client writes exist — all mutations go through the RPC)
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Verified users can like comments" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can unlike their own comment likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can unlike their own" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can like comments" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can delete their own comment likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can insert their own comment likes" ON public.comment_likes;

REVOKE INSERT, UPDATE, DELETE ON public.comment_likes FROM anon, authenticated;
GRANT SELECT ON public.comment_likes TO anon, authenticated;
GRANT ALL ON public.comment_likes TO service_role;

REVOKE ALL ON FUNCTION public.toggle_comment_like(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_comment_like(uuid, text, uuid) TO authenticated;

-- ---------------------------------------------------------
-- 4. Shared mention parser (single authority, internal only)
--    Reproduces the existing add_comment behaviour byte-for-byte:
--    same regex, lower/trim normalization, dedupe on handle, 5-mention cap
--    counted only for resolvable non-self profiles, deleted profiles skipped.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parse_comment_mentions(p_content text, p_author_id uuid)
 RETURNS TABLE(user_id uuid, username text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  mention_match text;
  trimmed_mention text;
  mentioned_uid uuid;
  mentioned_username text;
  mention_count int := 0;
  seen_mentions text[] := '{}';
BEGIN
  FOR mention_match IN
    SELECT m[1] FROM regexp_matches(COALESCE(p_content, ''), '(?:^|[^a-z0-9.@])@([a-z0-9._]+)', 'gi') AS m
  LOOP
    trimmed_mention := LOWER(TRIM(mention_match));

    IF trimmed_mention = ANY(seen_mentions) THEN
      CONTINUE;
    END IF;

    IF mention_count >= 5 THEN
      EXIT;
    END IF;

    seen_mentions := array_append(seen_mentions, trimmed_mention);

    SELECT p.id, p.username INTO mentioned_uid, mentioned_username
    FROM public.profiles p
    WHERE LOWER(p.username) = trimmed_mention
      AND (p.deleted_at IS NULL)
    LIMIT 1;

    IF mentioned_uid IS NULL THEN
      CONTINUE;
    END IF;

    IF mentioned_uid = p_author_id THEN
      CONTINUE;
    END IF;

    mention_count := mention_count + 1;

    user_id := mentioned_uid;
    username := mentioned_username;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public.parse_comment_mentions(text, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------
-- 5. add_comment — delegate mention parsing to the shared helper
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_comment(p_item_id uuid, p_item_type text, p_content text, p_user_id uuid, p_parent_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  comment_table text;
  id_field text;
  parent_table text;
  parent_parent_id uuid;
  parent_found boolean := false;
  new_comment_id uuid;
  mention_rec record;
  parent_author_id uuid;
  commenter_username text;
  item_action_url text;
BEGIN
  IF p_item_type NOT IN ('recommendation', 'post') THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  -- Auth guard: prevent user_id spoofing
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_item_type = 'recommendation' THEN
    comment_table := 'recommendation_comments';
    id_field := 'recommendation_id';
    parent_table := 'recommendations';
  ELSE
    comment_table := 'post_comments';
    id_field := 'post_id';
    parent_table := 'posts';
  END IF;

  -- Validate parent_id if provided (enforce 1-level threading)
  IF p_parent_id IS NOT NULL THEN
    EXECUTE format('
      SELECT parent_id, true
      FROM %I
      WHERE id = $1 AND COALESCE(is_deleted, false) = false
      LIMIT 1
    ', comment_table)
    INTO parent_parent_id, parent_found
    USING p_parent_id;

    IF NOT COALESCE(parent_found, false) THEN
      RAISE EXCEPTION 'Parent comment not found or deleted';
    END IF;

    IF parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reply to a reply (max 1 level of nesting)';
    END IF;
  END IF;

  EXECUTE format('
    INSERT INTO %I (%I, user_id, content, parent_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  ', comment_table, id_field)
  INTO new_comment_id
  USING p_item_id, p_user_id, p_content, p_parent_id;

  EXECUTE format('
    UPDATE %I
    SET comment_count = comment_count + 1
    WHERE id = $1
  ', parent_table)
  USING p_item_id;

  SELECT username INTO commenter_username
  FROM public.profiles
  WHERE id = p_user_id AND (deleted_at IS NULL);

  commenter_username := COALESCE(commenter_username, 'Someone');

  IF p_item_type = 'post' THEN
    item_action_url := '/post/' || p_item_id::text || '?commentId=' || new_comment_id::text;
  ELSE
    item_action_url := '/recommendations/' || p_item_id::text || '?commentId=' || new_comment_id::text;
  END IF;

  -- Process @mentions via the shared parser (max 5, self and deleted skipped)
  FOR mention_rec IN
    SELECT m.user_id, m.username FROM public.parse_comment_mentions(p_content, p_user_id) m
  LOOP
    INSERT INTO public.comment_mentions (comment_id, comment_type, mentioned_user_id, mentioner_user_id)
    VALUES (new_comment_id, p_item_type, mention_rec.user_id, p_user_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, sender_id, type, title, message, entity_id, entity_type, action_url, metadata)
    SELECT
      mention_rec.user_id,
      p_user_id,
      'comment',
      commenter_username || ' mentioned you',
      LEFT(p_content, 200),
      p_item_id,
      p_item_type,
      item_action_url,
      jsonb_build_object('event', 'mention', 'comment_id', new_comment_id::text)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = mention_rec.user_id
        AND n.sender_id = p_user_id
        AND n.entity_id = p_item_id
        AND n.entity_type = p_item_type
        AND n.metadata->>'comment_id' = new_comment_id::text
        AND n.metadata->>'event' = 'mention'
        AND n.retracted_at IS NULL
    );
  END LOOP;

  -- Notify parent comment author on reply (skip if already mentioned or self-reply)
  IF p_parent_id IS NOT NULL THEN
    EXECUTE format('
      SELECT user_id FROM %I WHERE id = $1
    ', comment_table)
    INTO parent_author_id
    USING p_parent_id;

    IF parent_author_id IS NOT NULL
       AND parent_author_id <> p_user_id
       AND NOT EXISTS (
         SELECT 1 FROM public.comment_mentions cm
         WHERE cm.comment_id = new_comment_id
           AND cm.comment_type = p_item_type
           AND cm.mentioned_user_id = parent_author_id
       )
    THEN
      INSERT INTO public.notifications (user_id, sender_id, type, title, message, entity_id, entity_type, action_url, metadata)
      SELECT
        parent_author_id,
        p_user_id,
        'comment',
        commenter_username || ' replied to your comment',
        LEFT(p_content, 200),
        p_item_id,
        p_item_type,
        item_action_url,
        jsonb_build_object('event', 'reply', 'comment_id', new_comment_id::text)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = parent_author_id
          AND n.sender_id = p_user_id
          AND n.entity_id = p_item_id
          AND n.entity_type = p_item_type
          AND n.metadata->>'comment_id' = new_comment_id::text
          AND n.metadata->>'event' = 'reply'
          AND n.retracted_at IS NULL
      );
    END IF;
  END IF;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------
-- 6. update_comment — mention reconciliation + preview refresh
--    Notifications are driven by ACTUAL membership changes (RETURNING),
--    never by a diff computed before the write, so overlapping edits and
--    retries stay correct and idempotent.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_comment(p_comment_id uuid, p_content text, p_user_id uuid, p_item_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  comment_table text;
  id_field text;
  did_update boolean;
  parent_item_id uuid;
  editor_username text;
  item_action_url text;
  removed_uid uuid;
  added_uid uuid;
BEGIN
  IF p_item_type NOT IN ('recommendation', 'post') THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  -- Auth guard: prevent user_id spoofing
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_item_type = 'recommendation' THEN
    comment_table := 'recommendation_comments';
    id_field := 'recommendation_id';
  ELSE
    comment_table := 'post_comments';
    id_field := 'post_id';
  END IF;

  EXECUTE format('
    UPDATE %I
    SET content = $1, updated_at = now(), edited_at = now()
    WHERE id = $2 AND user_id = $3 AND COALESCE(is_deleted, false) = false
    RETURNING true
  ', comment_table)
  INTO did_update
  USING p_content, p_comment_id, p_user_id;

  IF NOT COALESCE(did_update, false) THEN
    RETURN false;
  END IF;

  EXECUTE format('SELECT %I FROM %I WHERE id = $1', id_field, comment_table)
  INTO parent_item_id
  USING p_comment_id;

  SELECT username INTO editor_username
  FROM public.profiles
  WHERE id = p_user_id AND (deleted_at IS NULL);

  editor_username := COALESCE(editor_username, 'Someone');

  IF p_item_type = 'post' THEN
    item_action_url := '/post/' || parent_item_id::text || '?commentId=' || p_comment_id::text;
  ELSE
    item_action_url := '/recommendations/' || parent_item_id::text || '?commentId=' || p_comment_id::text;
  END IF;

  -- 6a. Removed mentions: retract only for rows actually deleted.
  FOR removed_uid IN
    DELETE FROM public.comment_mentions cm
    WHERE cm.comment_id = p_comment_id
      AND cm.comment_type = p_item_type
      AND cm.mentioned_user_id NOT IN (
        SELECT m.user_id FROM public.parse_comment_mentions(p_content, p_user_id) m
      )
    RETURNING cm.mentioned_user_id
  LOOP
    UPDATE public.notifications n
    SET retracted_at = now(), updated_at = now()
    WHERE n.retracted_at IS NULL
      AND n.type = 'comment'
      AND n.user_id = removed_uid
      AND n.sender_id = p_user_id
      AND n.entity_type = p_item_type
      AND n.entity_id = parent_item_id
      AND n.metadata->>'comment_id' = p_comment_id::text
      AND n.metadata->>'event' = 'mention';
  END LOOP;

  -- 6b. Added mentions: notify only for rows actually inserted.
  FOR added_uid IN
    INSERT INTO public.comment_mentions (comment_id, comment_type, mentioned_user_id, mentioner_user_id)
    SELECT p_comment_id, p_item_type, m.user_id, p_user_id
    FROM public.parse_comment_mentions(p_content, p_user_id) m
    ON CONFLICT (comment_id, comment_type, mentioned_user_id) DO NOTHING
    RETURNING mentioned_user_id
  LOOP
    INSERT INTO public.notifications (user_id, sender_id, type, title, message, entity_id, entity_type, action_url, metadata)
    SELECT
      added_uid,
      p_user_id,
      'comment',
      editor_username || ' mentioned you',
      LEFT(p_content, 200),
      parent_item_id,
      p_item_type,
      item_action_url,
      jsonb_build_object('event', 'mention', 'comment_id', p_comment_id::text)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = added_uid
        AND n.sender_id = p_user_id
        AND n.entity_id = parent_item_id
        AND n.entity_type = p_item_type
        AND n.metadata->>'comment_id' = p_comment_id::text
        AND n.metadata->>'event' = 'mention'
        AND n.retracted_at IS NULL
    );
  END LOOP;

  -- 6c. Preview refresh per notification shape. Never touches is_read or created_at.
  --     mention / reply rows -> message preview (title untouched)
  UPDATE public.notifications n
  SET message = LEFT(p_content, 200), updated_at = now()
  WHERE n.retracted_at IS NULL
    AND n.type = 'comment'
    AND n.sender_id = p_user_id
    AND n.metadata->>'comment_id' = p_comment_id::text
    AND n.metadata->>'event' IN ('mention', 'reply');

  --     plain "commented on ..." rows -> metadata.comment_text only
  UPDATE public.notifications n
  SET metadata = jsonb_set(
        COALESCE(n.metadata, '{}'::jsonb),
        '{comment_text}',
        to_jsonb(substring(p_content, 1, 50) || CASE WHEN length(p_content) > 50 THEN '...' ELSE '' END)
      ),
      updated_at = now()
  WHERE n.retracted_at IS NULL
    AND n.type = 'comment'
    AND n.sender_id = p_user_id
    AND n.metadata->>'comment_id' = p_comment_id::text
    AND n.metadata->>'event' IS NULL;

  --     comment-like rows have no body preview: intentionally left untouched.

  RETURN true;
END;
$function$;