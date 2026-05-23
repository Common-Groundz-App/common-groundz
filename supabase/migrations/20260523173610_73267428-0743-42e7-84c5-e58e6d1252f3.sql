-- ============================================================
-- Phase 3C.1 — Mapping sync after post edits
-- ============================================================

-- 1A. Extend status enum to include 'removed'
ALTER TABLE public.mux_upload_mappings
  DROP CONSTRAINT IF EXISTS mux_upload_mappings_status_check;
ALTER TABLE public.mux_upload_mappings
  ADD CONSTRAINT mux_upload_mappings_status_check
  CHECK (status IN ('pending','patched','orphaned','errored','removed'));

-- 1B. Active-only slot uniqueness
ALTER TABLE public.mux_upload_mappings
  DROP CONSTRAINT IF EXISTS mux_upload_mappings_slot_unique;

CREATE UNIQUE INDEX IF NOT EXISTS mux_upload_mappings_active_slot_unique
  ON public.mux_upload_mappings (content_type, content_id, media_index)
  WHERE status IN ('pending','patched','errored');

-- ============================================================
-- 2A. Patch patch_content_media_from_mux: add noop_removed guard
--     (same body as before; only the early-return block changes)
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
  IF v_mapping.status = 'removed'  THEN RETURN 'noop_removed';         END IF;

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
-- 2B. sync_mux_post_mappings — atomic per-post reconciliation
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_mux_post_mappings(
  p_content_id uuid,
  p_items      jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_park_offset  constant int := 1000000;
  v_results      jsonb := '[]'::jsonb;
  v_item         jsonb;
  v_uid          text;
  v_target_idx   int;
  v_existing     record;
  v_patch_result text;
  v_mapping_id   uuid;
  v_park_counter int := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_content_id::text, 0));

  CREATE TEMP TABLE _sync_items (
    mux_upload_id text PRIMARY KEY,
    media_index   int  NOT NULL
  ) ON COMMIT DROP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_uid := v_item ->> 'mux_upload_id';
    v_target_idx := (v_item ->> 'media_index')::int;
    IF v_uid IS NULL OR v_target_idx IS NULL OR v_target_idx < 0 THEN
      RAISE EXCEPTION 'invalid_item';
    END IF;
    INSERT INTO _sync_items(mux_upload_id, media_index) VALUES (v_uid, v_target_idx);
  END LOOP;

  PERFORM 1
    FROM public.mux_upload_mappings
   WHERE content_type = 'post' AND content_id = p_content_id
   FOR UPDATE;

  -- (a) GONE + active -> 'removed'
  UPDATE public.mux_upload_mappings m
     SET status = 'removed', last_error = NULL
   WHERE m.content_type = 'post'
     AND m.content_id = p_content_id
     AND m.status IN ('pending','patched','errored')
     AND NOT EXISTS (SELECT 1 FROM _sync_items s WHERE s.mux_upload_id = m.mux_upload_id);

  -- (b) PARK moved active rows
  FOR v_existing IN
    SELECT m.id
      FROM public.mux_upload_mappings m
      JOIN _sync_items s ON s.mux_upload_id = m.mux_upload_id
     WHERE m.content_type = 'post'
       AND m.content_id = p_content_id
       AND m.status IN ('pending','patched','errored')
       AND m.media_index <> s.media_index
     ORDER BY m.id
  LOOP
    v_park_counter := v_park_counter + 1;
    UPDATE public.mux_upload_mappings
       SET media_index = v_park_offset + v_park_counter
     WHERE id = v_existing.id;
  END LOOP;

  -- (c) Place parked rows at final media_index
  UPDATE public.mux_upload_mappings m
     SET media_index = s.media_index
    FROM _sync_items s
   WHERE m.content_type = 'post'
     AND m.content_id = p_content_id
     AND m.mux_upload_id = s.mux_upload_id
     AND m.status IN ('pending','patched','errored')
     AND m.media_index >= v_park_offset;

  -- (d) REACTIVATE previously 'removed' rows that reappear
  UPDATE public.mux_upload_mappings m
     SET status = 'pending',
         media_index = s.media_index,
         last_error = NULL,
         retry_count = 0,
         patched_at = NULL
    FROM _sync_items s
   WHERE m.content_type = 'post'
     AND m.content_id = p_content_id
     AND m.mux_upload_id = s.mux_upload_id
     AND m.status = 'removed';

  -- (e) NEW INSERTs
  FOR v_item IN
    SELECT to_jsonb(s) FROM _sync_items s
     WHERE NOT EXISTS (
       SELECT 1 FROM public.mux_upload_mappings m
        WHERE m.content_type = 'post'
          AND m.content_id = p_content_id
          AND m.mux_upload_id = s.mux_upload_id
     )
  LOOP
    v_uid := v_item ->> 'mux_upload_id';
    v_target_idx := (v_item ->> 'media_index')::int;
    BEGIN
      INSERT INTO public.mux_upload_mappings
        (mux_upload_id, content_type, content_id, media_index, user_id)
      SELECT v_uid, 'post', p_content_id, v_target_idx, p.user_id
        FROM public.posts p WHERE p.id = p_content_id;
    EXCEPTION WHEN unique_violation THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'mux_upload_id', v_uid,
        'status', 'conflict',
        'error', 'mux_upload_id_already_mapped_elsewhere'
      ));
    END;
  END LOOP;

  -- (f) Catch-up patch
  FOR v_item IN SELECT to_jsonb(s) FROM _sync_items s LOOP
    v_uid := v_item ->> 'mux_upload_id';

    SELECT m.id INTO v_mapping_id
      FROM public.mux_upload_mappings m
     WHERE m.content_type = 'post'
       AND m.content_id = p_content_id
       AND m.mux_upload_id = v_uid;

    IF v_mapping_id IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.mux_upload_mappings m
       WHERE m.id = v_mapping_id AND m.status = 'pending'
    ) AND EXISTS (
      SELECT 1 FROM public.mux_uploads u
       WHERE u.upload_id = v_uid AND u.status::text IN ('ready','errored')
    ) THEN
      BEGIN
        SELECT public.patch_content_media_from_mux(v_mapping_id) INTO v_patch_result;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'mux_upload_id', v_uid,
          'status', v_patch_result
        ));
      EXCEPTION WHEN OTHERS THEN
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'mux_upload_id', v_uid,
          'status', 'errored_patch',
          'error', SQLERRM
        ));
      END;
    ELSE
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'mux_upload_id', v_uid,
        'status', 'noop_synced'
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('results', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) TO service_role;