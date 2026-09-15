-- ============================================================
-- Phase 4.3 Gate 1 — complete write freeze on the legacy layer
-- Applied as a single atomic migration. No data is deleted here.
-- Nothing is GRANTED: reads already exist and stay untouched.
-- ============================================================

-- 1. Application roles lose every non-read privilege (SELECT untouched).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendation_likes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendation_saves FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendation_comments FROM anon, authenticated;

-- 1b. service_role narrowed to exactly what the Gate 4 cleanup performs on these
--     four tables: SELECT (manifest validation) and DELETE (row removal).
--     Gate 4 never UPDATEs them — the review-marker UPDATEs target public.reviews.
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendations FROM service_role;
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendation_likes FROM service_role;
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendation_saves FROM service_role;
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendation_comments FROM service_role;

-- 2. Drop every write policy; SELECT policies stay
DROP POLICY IF EXISTS "Users can insert their own recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Users can update their own recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Users can delete their own recommendations" ON public.recommendations;

DROP POLICY IF EXISTS "Users can insert their own likes" ON public.recommendation_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.recommendation_likes;

DROP POLICY IF EXISTS "Users can insert their own saves" ON public.recommendation_saves;
DROP POLICY IF EXISTS "Users can delete their own saves" ON public.recommendation_saves;

DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.recommendation_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.recommendation_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.recommendation_comments;

-- 3. Legacy-only routines lose EXECUTE from PUBLIC, application roles AND service_role.
--    (Verified live: service_role held an explicit EXECUTE grant on all six.)
--    Gate 4 uses direct audited DML and does not call these routines; only postgres
--    (owner) retains execution until the Phase 4.5 physical drops.
REVOKE ALL ON FUNCTION public.toggle_recommendation_like(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_recommendation_view(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_recommendation_likes_by_ids(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_recommendation_likes(uuid[], uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_recommendation_comment_notification() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_recommendation_like_notification() FROM PUBLIC, anon, authenticated, service_role;

-- 4. Shared routines become post-only. Identity signatures, return shapes,
--    volatility, owner, grants and post behaviour are preserved; only the
--    legacy branch is removed and legacy input is now explicitly rejected.

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
  IF p_item_type <> 'post' THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  comment_table := 'post_comments';
  id_field := 'post_id';
  parent_table := 'posts';

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

  item_action_url := '/post/' || p_item_id::text || '?commentId=' || new_comment_id::text;

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
    WHERE public.notification_allowed(mention_rec.user_id, 'mentions')
      AND NOT EXISTS (
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
      WHERE public.notification_allowed(parent_author_id, 'replies')
        AND NOT EXISTS (
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
  mentioned_uid uuid;
BEGIN
  IF p_item_type <> 'post' THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  comment_table := 'post_comments';
  id_field := 'post_id';

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

  item_action_url := '/post/' || parent_item_id::text || '?commentId=' || p_comment_id::text;

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
    WHERE public.notification_allowed(added_uid, 'mentions')
      AND NOT EXISTS (
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

  FOR mentioned_uid IN
    SELECT m.user_id FROM public.parse_comment_mentions(p_content, p_user_id) m
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.retracted_at IS NULL
        AND n.type = 'comment'
        AND n.user_id = mentioned_uid
        AND n.sender_id = p_user_id
        AND n.entity_type = p_item_type
        AND n.entity_id = parent_item_id
        AND n.metadata->>'comment_id' = p_comment_id::text
        AND n.metadata->>'event' = 'mention'
    ) THEN
      UPDATE public.notifications n
      SET retracted_at = now(), updated_at = now()
      WHERE n.retracted_at IS NULL
        AND n.type = 'comment'
        AND n.user_id = mentioned_uid
        AND n.sender_id = p_user_id
        AND n.entity_type = p_item_type
        AND n.entity_id = parent_item_id
        AND n.metadata->>'comment_id' = p_comment_id::text
        AND n.metadata->>'event' IS NULL;
    END IF;
  END LOOP;

  UPDATE public.notifications n
  SET message = LEFT(p_content, 200), updated_at = now()
  WHERE n.retracted_at IS NULL
    AND n.type = 'comment'
    AND n.sender_id = p_user_id
    AND n.metadata->>'comment_id' = p_comment_id::text
    AND n.metadata->>'event' IN ('mention', 'reply');

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

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_comment(p_comment_id uuid, p_item_type text, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  comment_table text;
  parent_table text;
  id_field text;
  v_item_id uuid;
  v_parent_id uuid;
  reply_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_item_type <> 'post' THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  comment_table := 'post_comments';
  id_field := 'post_id';
  parent_table := 'posts';

  EXECUTE format('
    SELECT %I, parent_id FROM %I WHERE id = $1 AND user_id = $2 AND is_deleted = false
  ', id_field, comment_table)
  INTO v_item_id, v_parent_id
  USING p_comment_id, p_user_id;

  IF v_item_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_parent_id IS NULL THEN
    EXECUTE format('
      SELECT COUNT(*) FROM %I WHERE parent_id = $1 AND is_deleted = false
    ', comment_table)
    INTO reply_count
    USING p_comment_id;
  ELSE
    reply_count := 0;
  END IF;

  EXECUTE format('
    UPDATE %I SET is_deleted = true, updated_at = now() WHERE id = $1
  ', comment_table)
  USING p_comment_id;

  IF v_parent_id IS NULL AND reply_count > 0 THEN
    EXECUTE format('
      UPDATE %I SET is_deleted = true, updated_at = now() WHERE parent_id = $1 AND is_deleted = false
    ', comment_table)
    USING p_comment_id;
  END IF;

  EXECUTE format('
    UPDATE %I
    SET comment_count = GREATEST(comment_count - $1, 0)
    WHERE id = $2
  ', parent_table)
  USING (1 + reply_count), v_item_id;

  RETURN true;
END;
$function$;

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
  IF p_comment_type <> 'post' THEN
    RAISE EXCEPTION 'Invalid comment type: %', p_comment_type;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  comment_table := 'post_comments';
  id_field := 'post_id';

  SELECT id INTO existing_like_id
  FROM public.comment_likes
  WHERE comment_id = p_comment_id
    AND comment_type = p_comment_type
    AND user_id = p_user_id;

  IF existing_like_id IS NOT NULL THEN
    DELETE FROM public.comment_likes WHERE id = existing_like_id;

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

      item_action_url := '/post/' || parent_item_id::text || '?commentId=' || p_comment_id::text;

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
      WHERE public.notification_allowed(comment_author_id, 'comment_likes')
        AND NOT EXISTS (
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

CREATE OR REPLACE FUNCTION public.increment_comment_count(table_name text, item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF table_name <> 'posts' THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;

  UPDATE public.posts
  SET comment_count = comment_count + 1
  WHERE id = item_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_comments_with_profiles(p_table_name text, p_id_field text, p_item_id uuid)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, user_id uuid, username text, avatar_url text, first_name text, last_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query text;
BEGIN
  IF p_table_name <> 'post_comments' THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  IF p_id_field <> 'post_id' THEN
    RAISE EXCEPTION 'Invalid ID field: %', p_id_field;
  END IF;

  query := format('
    SELECT
      c.id,
      c.content,
      c.created_at,
      c.user_id,
      p.username,
      p.avatar_url,
      p.first_name,
      p.last_name
    FROM public.%I c
    LEFT JOIN public.profiles p ON c.user_id = p.id
    WHERE c.%I = %L
      AND c.is_deleted = false
      AND (p.deleted_at IS NULL OR p.id IS NULL)
    ORDER BY c.created_at ASC
  ', p_table_name, p_id_field, p_item_id);

  RETURN QUERY EXECUTE query;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_comments_with_profiles(p_table_name text, p_id_field text, p_item_id uuid, p_current_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, user_id uuid, username text, avatar_url text, first_name text, last_name text, edited_at timestamp with time zone, parent_id uuid, like_count bigint, reply_count bigint, is_liked boolean, is_from_circle boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query text;
  comment_type_val text;
BEGIN
  IF p_table_name <> 'post_comments' THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  IF p_id_field <> 'post_id' THEN
    RAISE EXCEPTION 'Invalid ID field: %', p_id_field;
  END IF;

  comment_type_val := 'post';

  query := format('
    SELECT
      c.id,
      c.content,
      c.created_at,
      c.user_id,
      p.username,
      p.avatar_url,
      p.first_name,
      p.last_name,
      CASE WHEN c.updated_at > c.created_at + interval ''1 second'' THEN c.updated_at ELSE NULL END as edited_at,
      c.parent_id,
      COALESCE((SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.comment_type = %L), 0) as like_count,
      COALESCE((SELECT COUNT(*) FROM %I ch WHERE ch.parent_id = c.id AND ch.is_deleted = false), 0) as reply_count,
      CASE WHEN %L IS NOT NULL THEN
        EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.comment_type = %L AND cl.user_id = %L::uuid)
      ELSE false END as is_liked,
      CASE WHEN %L IS NOT NULL THEN
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = %L::uuid AND f.following_id = c.user_id)
      ELSE false END as is_from_circle
    FROM %I c
    LEFT JOIN profiles p ON c.user_id = p.id AND (p.deleted_at IS NULL OR p.id IS NULL)
    WHERE c.%I = $1 AND c.is_deleted = false
    ORDER BY c.created_at ASC
  ', comment_type_val, p_table_name, p_current_user_id, comment_type_val, p_current_user_id, p_current_user_id, p_current_user_id, p_table_name, p_id_field);

  RETURN QUERY EXECUTE query USING p_item_id;
END;
$function$;

ALTER FUNCTION public.add_comment(uuid, text, text, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.update_comment(uuid, text, uuid, text) OWNER TO postgres;
ALTER FUNCTION public.delete_comment(uuid, text, uuid) OWNER TO postgres;
ALTER FUNCTION public.toggle_comment_like(uuid, text, uuid) OWNER TO postgres;
ALTER FUNCTION public.increment_comment_count(text, uuid) OWNER TO postgres;
ALTER FUNCTION public.get_comments_with_profiles(text, text, uuid) OWNER TO postgres;
ALTER FUNCTION public.get_comments_with_profiles(text, text, uuid, uuid) OWNER TO postgres;