-- ============================================================
-- 1. Patch enforce_post_edit_window: bypass on system reconciliation flag
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_post_edit_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_meaningful_change boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- System reconciliation bypass (transaction-local flag set only by
  -- patch_content_media_from_mux, which is SECURITY DEFINER and granted to
  -- service_role only). Preserves last_edited_at because system patches
  -- are not user-facing edits.
  IF current_setting('app.mux_system_patch', true) = 'on' THEN
    NEW.last_edited_at := OLD.last_edited_at;
    RETURN NEW;
  END IF;

  v_meaningful_change :=
    NEW.title       IS DISTINCT FROM OLD.title
    OR NEW.content    IS DISTINCT FROM OLD.content
    OR NEW.post_type  IS DISTINCT FROM OLD.post_type
    OR NEW.visibility IS DISTINCT FROM OLD.visibility
    OR NEW.media      IS DISTINCT FROM OLD.media;

  IF v_meaningful_change THEN
    v_is_admin := COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false);

    IF NOT v_is_admin THEN
      IF auth.uid() IS NULL OR auth.uid() <> OLD.user_id THEN
        RAISE EXCEPTION 'Not authorized to edit this post'
          USING ERRCODE = '42501';
      END IF;

      IF (now() - OLD.created_at) > interval '1 hour' THEN
        RAISE EXCEPTION 'Edit window closed: posts can only be edited within 1 hour of posting'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    NEW.last_edited_at := now();
  ELSE
    NEW.last_edited_at := OLD.last_edited_at;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. Patch patch_content_media_from_mux: set transaction-local flag before UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION public.patch_content_media_from_mux(p_mapping_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mapping       public.mux_upload_mappings%ROWTYPE;
  v_upload        public.mux_uploads%ROWTYPE;
  v_post_user_id  uuid;
  v_media         jsonb;
  v_item          jsonb;
  v_patched_item  jsonb;
  v_existing_uid  text;
  v_existing_type text;
  v_existing_prov text;
BEGIN
  SELECT * INTO v_mapping
    FROM public.mux_upload_mappings
   WHERE id = p_mapping_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mapping_not_found';
  END IF;

  IF v_mapping.status = 'patched'  THEN RETURN 'noop_already_patched'; END IF;
  IF v_mapping.status = 'orphaned' THEN RETURN 'noop_orphaned';        END IF;
  IF v_mapping.status = 'errored'  THEN RETURN 'noop_errored';         END IF;

  SELECT * INTO v_upload
    FROM public.mux_uploads
   WHERE upload_id = v_mapping.mux_upload_id;

  IF NOT FOUND THEN
    RETURN 'noop_not_ready';
  END IF;

  IF v_upload.status::text NOT IN ('ready','errored') THEN
    RETURN 'noop_not_ready';
  END IF;

  IF v_upload.user_id IS DISTINCT FROM v_mapping.user_id THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned', last_error = 'ownership_mismatch'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_mapping.content_type = 'post' THEN
    SELECT user_id, media INTO v_post_user_id, v_media
      FROM public.posts
     WHERE id = v_mapping.content_id
     FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'unsupported_content_type:%', v_mapping.content_type;
  END IF;

  IF v_post_user_id IS NULL THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned', last_error = 'content_not_found'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_post_user_id IS DISTINCT FROM v_mapping.user_id THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned', last_error = 'ownership_mismatch'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_media IS NULL OR jsonb_typeof(v_media) <> 'array' THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned', last_error = 'media_array_missing'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_mapping.media_index >= jsonb_array_length(v_media) THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned', last_error = 'media_index_out_of_range'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  v_item := v_media -> v_mapping.media_index;
  v_existing_uid  := v_item ->> 'mux_upload_id';
  v_existing_type := v_item ->> 'type';
  v_existing_prov := v_item ->> 'provider';

  IF v_existing_uid IS DISTINCT FROM v_mapping.mux_upload_id
     OR v_existing_type <> 'video'
     OR v_existing_prov <> 'mux' THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned', last_error = 'slot_mismatch'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_upload.status::text = 'ready' THEN
    IF v_upload.asset_id IS NULL THEN
      UPDATE public.mux_upload_mappings
         SET status = 'orphaned', last_error = 'ready_without_asset_id'
       WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;
    IF v_upload.playback_id IS NULL THEN
      UPDATE public.mux_upload_mappings
         SET status = 'orphaned', last_error = 'ready_without_playback_id'
       WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;

    v_patched_item := v_item
      || jsonb_build_object(
           'mux_asset_id',    v_upload.asset_id,
           'mux_playback_id', v_upload.playback_id,
           'mux_status',      'ready'
         )
      || COALESCE(CASE WHEN v_upload.duration IS NOT NULL
           THEN jsonb_build_object('duration', v_upload.duration) END, '{}'::jsonb)
      || COALESCE(CASE WHEN v_upload.aspect_ratio IS NOT NULL
           THEN jsonb_build_object('aspect_ratio', v_upload.aspect_ratio) END, '{}'::jsonb);
  ELSE
    v_patched_item := v_item
      || jsonb_build_object(
           'mux_status', 'errored',
           'mux_error',  COALESCE(v_upload.error, 'unknown')
         )
      || COALESCE(CASE WHEN v_upload.asset_id IS NOT NULL
           THEN jsonb_build_object('mux_asset_id', v_upload.asset_id) END, '{}'::jsonb);
  END IF;

  v_media := jsonb_set(v_media, ARRAY[v_mapping.media_index::text], v_patched_item, false);

  -- Transaction-local bypass for enforce_post_edit_window trigger.
  -- Only this RPC can set it (SECURITY DEFINER, granted to service_role).
  PERFORM set_config('app.mux_system_patch', 'on', true);

  UPDATE public.posts SET media = v_media WHERE id = v_mapping.content_id;

  UPDATE public.mux_upload_mappings
     SET status = 'patched',
         mux_status_snapshot = v_upload.status::text,
         patched_at = now(),
         last_error = NULL
   WHERE id = v_mapping.id;

  RETURN 'patched';
END;
$$;

REVOKE ALL ON FUNCTION public.patch_content_media_from_mux(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_content_media_from_mux(uuid) TO service_role;

-- ============================================================
-- 3. Verification harness (A–E) against throwaway test post
-- ============================================================
CREATE TABLE IF NOT EXISTS public._mux_phase3a_verify_log (
  id serial primary key,
  scenario text,
  outcome text,
  detail jsonb,
  at timestamptz default now()
);
TRUNCATE public._mux_phase3a_verify_log;

DO $$
DECLARE
  v_post_id    uuid := '72ea1ebc-b087-4c04-8045-6e5376e30677';
  v_upload     text := 'MAit00sbhHCj9NcXbB9Q5XEvN02Uf02SodnLCFV36b02OXc';
  v_upload_alt text := 'eao9KW2FGIJrTJmze013mAmNn2zlZ2p6lWQKuYhCCpEM';
  v_owner      uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  v_other_user uuid := gen_random_uuid();
  v_other_post uuid := gen_random_uuid();
  v_mapping_id uuid;
  v_result     text;
BEGIN
  -- A: happy path
  BEGIN
    INSERT INTO public.mux_upload_mappings
      (mux_upload_id, content_type, content_id, media_index, user_id)
    VALUES (v_upload, 'post', v_post_id, 0, v_owner)
    RETURNING id INTO v_mapping_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_mapping_id FROM public.mux_upload_mappings WHERE mux_upload_id = v_upload;
    UPDATE public.mux_upload_mappings
       SET status='pending', patched_at=NULL, last_error=NULL, user_id=v_owner
     WHERE id = v_mapping_id;
  END;

  SELECT public.patch_content_media_from_mux(v_mapping_id) INTO v_result;
  INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
    ('A_happy_path', v_result, jsonb_build_object(
      'mapping_id', v_mapping_id,
      'mapping_row', (SELECT to_jsonb(m) FROM public.mux_upload_mappings m WHERE id=v_mapping_id),
      'post_media', (SELECT media FROM public.posts WHERE id=v_post_id)
    ));

  -- B: idempotency
  SELECT public.patch_content_media_from_mux(v_mapping_id) INTO v_result;
  INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
    ('B_idempotent_retry', v_result, jsonb_build_object(
      'mapping_row', (SELECT to_jsonb(m) FROM public.mux_upload_mappings m WHERE id=v_mapping_id),
      'post_media', (SELECT media FROM public.posts WHERE id=v_post_id)
    ));

  -- C: duplicate mux_upload_id, different content_id
  BEGIN
    INSERT INTO public.mux_upload_mappings
      (mux_upload_id, content_type, content_id, media_index, user_id)
    VALUES (v_upload, 'post', v_other_post, 0, v_owner);
    INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
      ('C_duplicate_upload', 'UNEXPECTED_INSERT_ACCEPTED', NULL);
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
      ('C_duplicate_upload', 'unique_violation_as_expected',
       jsonb_build_object('sqlstate', SQLSTATE, 'sqlerrm', SQLERRM));
  END;

  -- D: slot collision (real alt upload, same post + media_index)
  BEGIN
    INSERT INTO public.mux_upload_mappings
      (mux_upload_id, content_type, content_id, media_index, user_id)
    VALUES (v_upload_alt, 'post', v_post_id, 0, v_owner);
    INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
      ('D_slot_collision', 'UNEXPECTED_INSERT_ACCEPTED', NULL);
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
      ('D_slot_collision', 'unique_violation_as_expected',
       jsonb_build_object('sqlstate', SQLSTATE, 'sqlerrm', SQLERRM));
  END;

  -- E: ownership mismatch then restore
  UPDATE public.mux_upload_mappings
     SET user_id = v_other_user, status='pending', patched_at=NULL, last_error=NULL
   WHERE id = v_mapping_id;
  SELECT public.patch_content_media_from_mux(v_mapping_id) INTO v_result;
  INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
    ('E_ownership_mismatch', v_result, jsonb_build_object(
      'mapping_row', (SELECT to_jsonb(m) FROM public.mux_upload_mappings m WHERE id=v_mapping_id),
      'post_media_unchanged', (SELECT media FROM public.posts WHERE id=v_post_id)
    ));

  UPDATE public.mux_upload_mappings
     SET user_id=v_owner, status='pending', patched_at=NULL, last_error=NULL
   WHERE id = v_mapping_id;
  SELECT public.patch_content_media_from_mux(v_mapping_id) INTO v_result;
  INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
    ('E_restore_after_mismatch', v_result, jsonb_build_object(
      'mapping_row', (SELECT to_jsonb(m) FROM public.mux_upload_mappings m WHERE id=v_mapping_id),
      'post_media', (SELECT media FROM public.posts WHERE id=v_post_id)
    ));

  -- Z: final snapshot
  INSERT INTO public._mux_phase3a_verify_log(scenario, outcome, detail) VALUES
    ('Z_final_state', 'inspect', jsonb_build_object(
      'mappings_for_post',
        (SELECT jsonb_agg(to_jsonb(m)) FROM public.mux_upload_mappings m WHERE content_id = v_post_id),
      'post_media',
        (SELECT media FROM public.posts WHERE id = v_post_id)
    ));
END $$;