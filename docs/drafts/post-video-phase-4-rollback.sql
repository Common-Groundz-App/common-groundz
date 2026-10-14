-- ROLLBACK for Post video Phase 4 Step 2 (DRAFT, not executed).
-- Restores the live definitions captured read-only on 2026-10-14 17:10 UTC
-- (pg_get_functiondef). Single transaction, no CASCADE.
-- Captured md5 of each live definition (verify after rollback):
--   patch_content_media_from_mux  84e1604af0f69c2213675776bf319caa
--   post_mux_link_items           5bee2c8fa76afa13383a1da4d4ed3f02
--   posts_media_mux_before        5858bb1fa1f13079ad16616e159ee8cc
--   sync_mux_post_mappings        b28a549c7e2de46875211bf86eeb5f65
--   sync_mux_post_mappings_core   c569291a1d3a0215b843f5bb59bdce7a
-- Captured grants (all five): {postgres=X/postgres,service_role=X/postgres}
BEGIN;

-- 1. Restore replaced functions (removes every reference to helpers / media_id)
CREATE OR REPLACE FUNCTION public.patch_content_media_from_mux(p_mapping_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mapping public.mux_upload_mappings%ROWTYPE; v_upload public.mux_uploads%ROWTYPE;
  v_post_user_id uuid; v_media jsonb; v_item jsonb; v_patched_item jsonb;
  v_existing_uid text; v_existing_type text; v_existing_prov text; v_ct text;
  v_content_id uuid;
BEGIN
  SELECT content_type, content_id INTO v_ct, v_content_id FROM public.mux_upload_mappings WHERE id = p_mapping_id;
  IF v_ct IN ('review','review_update') THEN RETURN public.patch_review_media_from_mux(p_mapping_id); END IF;

  IF v_ct = 'post' THEN
    -- Lock order: Post row -> advisory -> mapping row (same as save/reconcile/sync).
    SELECT user_id, media INTO v_post_user_id, v_media FROM public.posts WHERE id = v_content_id FOR UPDATE;
    IF FOUND THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(v_content_id::text, 0));
    END IF;
  END IF;

  SELECT * INTO v_mapping FROM public.mux_upload_mappings WHERE id = p_mapping_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mapping_not_found'; END IF;
  IF v_mapping.status = 'patched'  THEN RETURN 'noop_already_patched'; END IF;
  IF v_mapping.status = 'orphaned' THEN RETURN 'noop_orphaned'; END IF;
  IF v_mapping.status = 'errored'  THEN RETURN 'noop_errored'; END IF;
  IF v_mapping.status = 'removed'  THEN RETURN 'noop_removed'; END IF;

  SELECT * INTO v_upload FROM public.mux_uploads WHERE upload_id = v_mapping.mux_upload_id;
  IF NOT FOUND THEN RETURN 'noop_not_ready'; END IF;
  IF v_upload.status::text NOT IN ('ready','errored') THEN RETURN 'noop_not_ready'; END IF;
  IF v_upload.user_id IS DISTINCT FROM v_mapping.user_id THEN
    UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'ownership_mismatch' WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_mapping.content_type <> 'post' THEN
    RAISE EXCEPTION 'unsupported_content_type:%', v_mapping.content_type;
  END IF;
  IF v_post_user_id IS NULL THEN
    UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'content_not_found' WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;
  IF v_post_user_id IS DISTINCT FROM v_mapping.user_id THEN
    UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'ownership_mismatch' WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;
  IF v_media IS NULL OR jsonb_typeof(v_media) <> 'array' THEN
    UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'media_array_missing' WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;
  IF v_mapping.media_index >= jsonb_array_length(v_media) THEN
    UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'media_index_out_of_range' WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  v_item := v_media -> v_mapping.media_index;
  v_existing_uid := v_item ->> 'mux_upload_id';
  v_existing_type := v_item ->> 'type';
  v_existing_prov := v_item ->> 'provider';
  IF v_existing_uid IS DISTINCT FROM v_mapping.mux_upload_id OR v_existing_type <> 'video' OR v_existing_prov <> 'mux' THEN
    UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'slot_mismatch' WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_upload.status::text = 'ready' AND NOT (v_upload.duration_rule_applies AND COALESCE(v_upload.duration,0) > 60) THEN
    IF v_upload.asset_id IS NULL THEN
      UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'ready_without_asset_id' WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;
    IF v_upload.playback_id IS NULL THEN
      UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'ready_without_playback_id' WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;
  END IF;

  v_patched_item := public.post_mux_truth_item(v_item, v_post_user_id);
  IF v_patched_item IS NOT DISTINCT FROM v_item THEN
    UPDATE public.mux_upload_mappings
       SET status = 'patched', mux_status_snapshot = v_upload.status::text, patched_at = now(), last_error = NULL
     WHERE id = v_mapping.id;
    RETURN 'patched';
  END IF;

  v_media := jsonb_set(v_media, ARRAY[v_mapping.media_index::text], v_patched_item, false);
  PERFORM set_config('app.mux_system_patch', 'on', true);
  UPDATE public.posts SET media = v_media WHERE id = v_mapping.content_id;
  PERFORM set_config('app.mux_system_patch', 'off', true);
  UPDATE public.mux_upload_mappings
     SET status = 'patched', mux_status_snapshot = v_upload.status::text, patched_at = now(), last_error = NULL
   WHERE id = v_mapping.id;
  RETURN 'patched';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.post_mux_link_items(p_post_id uuid, p_media jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object('mux_upload_id', e.item->>'mux_upload_id', 'media_index', e.idx - 1) ORDER BY e.idx), '[]'::jsonb)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_media)='array' THEN p_media ELSE '[]'::jsonb END) WITH ORDINALITY e(item, idx)
   WHERE e.item->>'type'='video' AND e.item->>'provider'='mux' AND coalesce(e.item->>'mux_upload_id','') <> ''
     AND (EXISTS (SELECT 1 FROM public.mux_upload_mappings m WHERE m.content_type='post' AND m.content_id=p_post_id AND m.mux_upload_id=e.item->>'mux_upload_id')
          OR EXISTS (SELECT 1 FROM public.mux_uploads u WHERE u.upload_id=e.item->>'mux_upload_id' AND u.duration_rule_applies));
$function$
;

CREATE OR REPLACE FUNCTION public.posts_media_mux_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN OLD.media ELSE NULL END;
  v_old_n int := 0; v_old_v int := 0; v_new_n int; v_new_v int;
  v_item jsonb; v_prev jsonb; v_out jsonb := '[]'::jsonb; v_uid text;
BEGIN
  IF COALESCE(current_setting('app.mux_system_patch', true), 'off') = 'on' THEN
    IF NOT public.is_trusted_server_context() OR TG_OP <> 'UPDATE'
       OR NOT public.post_mux_patch_is_valid(to_jsonb(OLD), to_jsonb(NEW)) THEN
      RAISE EXCEPTION 'mux_patch_invalid' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.media IS NOT DISTINCT FROM OLD.media THEN RETURN NEW; END IF;
  IF NEW.media IS NULL OR jsonb_typeof(NEW.media) <> 'array' THEN RETURN NEW; END IF;

  IF v_old IS NOT NULL AND jsonb_typeof(v_old) = 'array' THEN
    v_old_n := jsonb_array_length(v_old); v_old_v := public.post_media_video_count(v_old);
  END IF;
  v_new_n := jsonb_array_length(NEW.media);
  v_new_v := public.post_media_video_count(NEW.media);
  IF v_new_n > 4 AND v_new_n > v_old_n THEN RAISE EXCEPTION 'post_media_too_many' USING ERRCODE = '22023'; END IF;
  IF v_new_v > 1 AND v_new_v > v_old_v THEN RAISE EXCEPTION 'post_video_too_many' USING ERRCODE = '22023'; END IF;

  FOR v_item IN SELECT e FROM jsonb_array_elements(NEW.media) WITH ORDINALITY t(e,o) ORDER BY o LOOP
    v_uid := NULLIF(v_item->>'mux_upload_id','');
    IF v_item->>'type' = 'video' AND (v_uid IS NOT NULL OR v_item->>'provider' = 'mux') THEN
      IF v_uid IS NULL THEN RAISE EXCEPTION 'post_video_not_owned' USING ERRCODE = '42501'; END IF;
      v_prev := NULL;
      IF v_old IS NOT NULL AND jsonb_typeof(v_old) = 'array' THEN
        SELECT e INTO v_prev FROM jsonb_array_elements(v_old) e WHERE e->>'mux_upload_id' = v_uid LIMIT 1;
      END IF;
      IF v_prev IS NULL OR (v_prev - 'order') IS DISTINCT FROM (v_item - 'order') THEN
        IF v_prev IS NULL AND EXISTS (SELECT 1 FROM public.mux_upload_mappings m
              WHERE m.mux_upload_id = v_uid AND m.status <> 'removed'
                AND NOT (m.content_type = 'post' AND m.content_id = NEW.id)) THEN
          RAISE EXCEPTION 'post_video_in_use' USING ERRCODE = '23505';
        END IF;
        v_item := public.post_mux_truth_item(v_item, NEW.user_id);
      END IF;
    END IF;
    v_out := v_out || jsonb_build_array(v_item);
  END LOOP;
  NEW.media := v_out;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.sync_mux_post_mappings(p_content_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM 1 FROM public.posts WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('results','[]'::jsonb, 'post','missing');
  END IF;
  RETURN public.sync_mux_post_mappings_core(p_content_id, p_items, true);
END $function$
;

CREATE OR REPLACE FUNCTION public.sync_mux_post_mappings_core(p_content_id uuid, p_items jsonb, p_patch boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_park_offset constant int := 1000000;
  v_results jsonb := '[]'::jsonb;
  v_item jsonb; v_uid text; v_target_idx int; v_existing record;
  v_patch_result text; v_mapping_id uuid; v_park_counter int := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'invalid_items'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_content_id::text, 0));

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_uid := v_item ->> 'mux_upload_id';
    v_target_idx := (v_item ->> 'media_index')::int;
    IF v_uid IS NULL OR v_target_idx IS NULL OR v_target_idx < 0 THEN RAISE EXCEPTION 'invalid_item'; END IF;
    v_items := v_items || jsonb_build_array(jsonb_build_object('mux_upload_id', v_uid, 'media_index', v_target_idx));
  END LOOP;

  PERFORM 1 FROM public.mux_upload_mappings WHERE content_type='post' AND content_id=p_content_id FOR UPDATE;

  UPDATE public.mux_upload_mappings m SET status='removed', last_error=NULL
   WHERE m.content_type='post' AND m.content_id=p_content_id AND m.status IN ('pending','patched','errored')
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) s WHERE s->>'mux_upload_id' = m.mux_upload_id);

  FOR v_existing IN
    SELECT m.id FROM public.mux_upload_mappings m
      JOIN jsonb_array_elements(v_items) s ON s->>'mux_upload_id' = m.mux_upload_id
     WHERE m.content_type='post' AND m.content_id=p_content_id AND m.status IN ('pending','patched','errored')
       AND m.media_index <> (s->>'media_index')::int
     ORDER BY m.id
  LOOP
    v_park_counter := v_park_counter + 1;
    UPDATE public.mux_upload_mappings SET media_index = v_park_offset + v_park_counter WHERE id = v_existing.id;
  END LOOP;

  UPDATE public.mux_upload_mappings m SET media_index = (s->>'media_index')::int
    FROM jsonb_array_elements(v_items) s
   WHERE m.content_type='post' AND m.content_id=p_content_id AND m.mux_upload_id = s->>'mux_upload_id'
     AND m.status IN ('pending','patched','errored') AND m.media_index >= v_park_offset;

  UPDATE public.mux_upload_mappings m
     SET status='pending', media_index=(s->>'media_index')::int, last_error=NULL, retry_count=0, patched_at=NULL
    FROM jsonb_array_elements(v_items) s
   WHERE m.content_type='post' AND m.content_id=p_content_id AND m.mux_upload_id = s->>'mux_upload_id' AND m.status='removed';

  FOR v_item IN SELECT s FROM jsonb_array_elements(v_items) s
     WHERE NOT EXISTS (SELECT 1 FROM public.mux_upload_mappings m
                        WHERE m.content_type='post' AND m.content_id=p_content_id AND m.mux_upload_id = s->>'mux_upload_id')
  LOOP
    v_uid := v_item ->> 'mux_upload_id';
    v_target_idx := (v_item ->> 'media_index')::int;
    BEGIN
      INSERT INTO public.mux_upload_mappings (mux_upload_id, content_type, content_id, media_index, user_id)
      SELECT v_uid, 'post', p_content_id, v_target_idx, p.user_id FROM public.posts p WHERE p.id = p_content_id;
    EXCEPTION WHEN unique_violation THEN
      IF NOT p_patch THEN
        RAISE EXCEPTION 'post_video_already_linked_elsewhere' USING ERRCODE = 'unique_violation';
      END IF;
      v_results := v_results || jsonb_build_array(jsonb_build_object('mux_upload_id', v_uid, 'status','conflict','error','mux_upload_id_already_mapped_elsewhere'));
    END;
  END LOOP;

  IF NOT p_patch THEN
    UPDATE public.mux_upload_mappings m
       SET status='patched', patched_at=now(), mux_status_snapshot = u.status::text, last_error=NULL
      FROM public.posts p, public.mux_uploads u
     WHERE m.content_type='post' AND m.content_id=p_content_id AND m.status='pending'
       AND p.id = p_content_id AND u.upload_id = m.mux_upload_id
       AND (p.media -> m.media_index ->> 'mux_upload_id') = m.mux_upload_id
       AND (p.media -> m.media_index ->> 'mux_status') IN ('ready','errored');
    RETURN jsonb_build_object('results', v_results);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_uid := v_item ->> 'mux_upload_id';
    SELECT m.id INTO v_mapping_id FROM public.mux_upload_mappings m
     WHERE m.content_type='post' AND m.content_id=p_content_id AND m.mux_upload_id=v_uid;
    IF v_mapping_id IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.mux_upload_mappings m WHERE m.id=v_mapping_id AND m.status='pending')
       AND EXISTS (SELECT 1 FROM public.mux_uploads u WHERE u.upload_id=v_uid AND u.status::text IN ('ready','errored')) THEN
      BEGIN
        SELECT public.patch_content_media_from_mux(v_mapping_id) INTO v_patch_result;
        v_results := v_results || jsonb_build_array(jsonb_build_object('mux_upload_id', v_uid, 'status', v_patch_result));
      EXCEPTION WHEN OTHERS THEN
        v_results := v_results || jsonb_build_array(jsonb_build_object('mux_upload_id', v_uid, 'status','errored_patch','error',SQLERRM));
      END;
    ELSE
      v_results := v_results || jsonb_build_array(jsonb_build_object('mux_upload_id', v_uid, 'status','noop_synced'));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('results', v_results);
END $function$
;

-- 2. New trigger, then its function
DROP TRIGGER IF EXISTS mux_mapping_require_media_id ON public.mux_upload_mappings;
DROP FUNCTION IF EXISTS public.mux_mapping_require_media_id();

-- 3. New helpers
DROP FUNCTION IF EXISTS public.post_media_assign_ids(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.post_media_identity(jsonb);
DROP FUNCTION IF EXISTS public.post_media_storage_key(text);

-- 4. New column (only new links lose their media_id; they revert to slot + upload-ID patching)
ALTER TABLE public.mux_upload_mappings DROP COLUMN IF EXISTS media_id;

-- 5. Reapply captured grants exactly
REVOKE ALL ON FUNCTION public.patch_content_media_from_mux(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_mux_link_items(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posts_media_mux_before() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_mux_post_mappings_core(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_content_media_from_mux(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_mux_link_items(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.posts_media_mux_before() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_mux_post_mappings_core(uuid, jsonb, boolean) TO service_role;

COMMIT;

-- 6. Read-only verification (run after): md5 must equal the captured values above.
-- SELECT proname, md5(pg_get_functiondef(oid)), proacl FROM pg_proc
--  WHERE pronamespace='public'::regnamespace AND proname IN
--  ('patch_content_media_from_mux','post_mux_link_items','posts_media_mux_before','sync_mux_post_mappings','sync_mux_post_mappings_core');
