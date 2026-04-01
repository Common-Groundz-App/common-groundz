-- Harden add_comment: auth guard + optimized reply notification check
CREATE OR REPLACE FUNCTION public.add_comment(
  p_item_id uuid,
  p_item_type text,
  p_content text,
  p_user_id uuid,
  p_parent_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_table text;
  id_field text;
  parent_table text;
  parent_parent_id uuid;
  new_comment_id uuid;
  mention_match text;
  mention_matches text[];
  mentioned_uid uuid;
  mentioned_username text;
  mention_count int := 0;
  seen_mentions text[] := '{}';
  trimmed_mention text;
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

  IF p_parent_id IS NOT NULL THEN
    EXECUTE format('
      SELECT parent_id FROM %I WHERE id = $1 AND is_deleted = false
    ', comment_table)
    INTO parent_parent_id
    USING p_parent_id;

    IF NOT FOUND THEN
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
    item_action_url := '/recommendation/' || p_item_id::text || '?commentId=' || new_comment_id::text;
  END IF;

  FOR mention_match IN
    SELECT m[1] FROM regexp_matches(p_content, '(?:^|[^a-z0-9.@])@([a-z0-9._]+)', 'gi') AS m
  LOOP
    trimmed_mention := LOWER(TRIM(mention_match));

    IF trimmed_mention = ANY(seen_mentions) THEN
      CONTINUE;
    END IF;

    IF mention_count >= 5 THEN
      EXIT;
    END IF;

    seen_mentions := array_append(seen_mentions, trimmed_mention);

    SELECT id, username INTO mentioned_uid, mentioned_username
    FROM public.profiles
    WHERE LOWER(username) = trimmed_mention
      AND (deleted_at IS NULL)
    LIMIT 1;

    IF mentioned_uid IS NULL THEN
      CONTINUE;
    END IF;

    IF mentioned_uid = p_user_id THEN
      CONTINUE;
    END IF;

    mention_count := mention_count + 1;

    INSERT INTO public.comment_mentions (comment_id, comment_type, mentioned_user_id, mentioner_user_id)
    VALUES (new_comment_id, p_item_type, mentioned_uid, p_user_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, sender_id, type, title, message, entity_id, entity_type, action_url, metadata)
    SELECT
      mentioned_uid,
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
      WHERE n.user_id = mentioned_uid
        AND n.sender_id = p_user_id
        AND n.entity_id = p_item_id
        AND n.entity_type = p_item_type
        AND n.metadata->>'comment_id' = new_comment_id::text
        AND n.metadata->>'event' = 'mention'
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
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = parent_author_id
          AND n.sender_id = p_user_id
          AND n.entity_id = p_item_id
          AND n.entity_type = p_item_type
          AND n.metadata->>'comment_id' = new_comment_id::text
          AND n.metadata->>'event' = 'reply'
      );
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- Harden toggle_comment_like: auth guard
CREATE OR REPLACE FUNCTION public.toggle_comment_like(
  p_comment_id uuid,
  p_comment_type text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT id INTO existing_like_id
  FROM public.comment_likes
  WHERE comment_id = p_comment_id
    AND comment_type = p_comment_type
    AND user_id = p_user_id;

  IF existing_like_id IS NOT NULL THEN
    DELETE FROM public.comment_likes WHERE id = existing_like_id;
    RETURN false;
  ELSE
    INSERT INTO public.comment_likes (comment_id, comment_type, user_id)
    VALUES (p_comment_id, p_comment_type, p_user_id);

    IF p_comment_type = 'post' THEN
      comment_table := 'post_comments';
      id_field := 'post_id';
    ELSE
      comment_table := 'recommendation_comments';
      id_field := 'recommendation_id';
    END IF;

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
        item_action_url := '/recommendation/' || parent_item_id::text || '?commentId=' || p_comment_id::text;
      END IF;

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
      );
    END IF;

    RETURN true;
  END IF;
END;
$$;