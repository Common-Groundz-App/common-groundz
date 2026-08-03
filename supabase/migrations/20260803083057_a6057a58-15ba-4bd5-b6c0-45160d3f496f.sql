DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'parse_comment_mentions'
  ) THEN
    RAISE EXCEPTION 'Dependency missing: public.parse_comment_mentions (Phase 2.5A). Aborting.';
  END IF;
END $$;

-- 1. post likes
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

  IF NOT public.notification_allowed(post_owner_id, 'likes') THEN
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
  ON CONFLICT (user_id, sender_id, entity_type, entity_id)
    WHERE retracted_at IS NULL AND type = 'like'
      AND (metadata->>'comment_id') IS NULL
      AND sender_id IS NOT NULL AND entity_id IS NOT NULL AND entity_type IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2. recommendation likes
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

  IF NOT public.notification_allowed(rec_owner_id, 'likes') THEN
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

-- 3. follows
CREATE OR REPLACE FUNCTION public.create_follow_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.notification_allowed(NEW.following_id, 'follows') THEN
    RETURN NEW;
  END IF;

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

-- 4. post comments (precedence: mention > reply > generic comment)
CREATE OR REPLACE FUNCTION public.create_post_comment_notification()
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
  FROM public.posts
  WHERE id = NEW.post_id;

  -- Don't notify yourself
  IF post_owner_id IS NULL OR post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Replies are owned by add_comment's reply notification
  IF NEW.parent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Mentions outrank the generic comment notification
  IF EXISTS (
    SELECT 1 FROM public.parse_comment_mentions(NEW.content, NEW.user_id) m
    WHERE m.user_id = post_owner_id
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT public.notification_allowed(post_owner_id, 'comments') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, sender_id, title, message, entity_type, entity_id, image_url, action_url, metadata
  )
  VALUES (
    post_owner_id,
    'comment',
    NEW.user_id,
    'New comment',
    (SELECT username FROM public.profiles WHERE id = NEW.user_id) || ' commented on ' || post_title,
    'post',
    NEW.post_id,
    (SELECT avatar_url FROM public.profiles WHERE id = NEW.user_id),
    '/post/' || NEW.post_id || '?commentId=' || NEW.id,
    jsonb_build_object(
      'comment_text', substring(NEW.content, 1, 50) || CASE WHEN length(NEW.content) > 50 THEN '...' ELSE '' END,
      'comment_id', NEW.id::text
    )
  );

  RETURN NEW;
END;
$function$;

-- 5. recommendation comments
CREATE OR REPLACE FUNCTION public.create_recommendation_comment_notification()
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
  FROM public.recommendations
  WHERE id = NEW.recommendation_id;

  IF rec_owner_id IS NULL OR rec_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.parse_comment_mentions(NEW.content, NEW.user_id) m
    WHERE m.user_id = rec_owner_id
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT public.notification_allowed(rec_owner_id, 'comments') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, sender_id, title, message, entity_type, entity_id, image_url, action_url, metadata
  )
  VALUES (
    rec_owner_id,
    'comment',
    NEW.user_id,
    'New comment',
    (SELECT username FROM public.profiles WHERE id = NEW.user_id) || ' commented on your recommendation for ' || rec_title,
    'recommendation',
    NEW.recommendation_id,
    (SELECT avatar_url FROM public.profiles WHERE id = NEW.user_id),
    '/recommendations/' || NEW.recommendation_id || '?commentId=' || NEW.id,
    jsonb_build_object(
      'comment_text', substring(NEW.content, 1, 50) || CASE WHEN length(NEW.content) > 50 THEN '...' ELSE '' END,
      'comment_id', NEW.id::text
    )
  );

  RETURN NEW;
END;
$function$;

-- 6. add_comment (mentions / replies)
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

-- 7. toggle_comment_like (comment likes)
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

-- 8. update_comment (mentions on edit + precedence replacement)
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
  IF p_item_type NOT IN ('recommendation', 'post') THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

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

  -- 6b-2. Precedence replacement: mention outranks the generic comment row.
  --       Insert-before-retract: only retract when an ACTIVE mention row exists.
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

  -- 6c. Preview refresh per notification shape. Never touches is_read or created_at.
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

-- Re-assert grants on touched RPCs (client-callable) and keep helper internal.
REVOKE ALL ON FUNCTION public.notification_allowed(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_allowed(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_comment(uuid, text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_comment(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_comment_like(uuid, text, uuid) TO authenticated;