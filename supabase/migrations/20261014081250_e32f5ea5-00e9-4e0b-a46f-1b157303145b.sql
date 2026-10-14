ALTER TABLE public.mux_uploads ADD COLUMN IF NOT EXISTS duration_rule_applies boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mux_uploads_duration_rule_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.duration_rule_applies := true;
  ELSE NEW.duration_rule_applies := OLD.duration_rule_applies; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mux_uploads_duration_rule_guard ON public.mux_uploads;
CREATE TRIGGER mux_uploads_duration_rule_guard BEFORE INSERT OR UPDATE ON public.mux_uploads
  FOR EACH ROW EXECUTE FUNCTION public.mux_uploads_duration_rule_guard();

CREATE OR REPLACE FUNCTION public.post_media_video_count(p_media jsonb)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_media IS NULL OR jsonb_typeof(p_media) <> 'array' THEN 0
    ELSE (SELECT count(*)::int FROM jsonb_array_elements(p_media) e WHERE e->>'type' = 'video') END
$$;

CREATE OR REPLACE FUNCTION public.post_mux_strip(p_item jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT p_item - 'provider' - 'url' - 'thumbnail_url' - 'mux_status' - 'mux_playback_id'
                - 'mux_asset_id' - 'mux_error' - 'duration' - 'aspect_ratio'
$$;

CREATE OR REPLACE FUNCTION public.post_mux_truth_item(p_item jsonb, p_owner uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_up public.mux_uploads%ROWTYPE; v_base jsonb; v_thumb text;
BEGIN
  SELECT * INTO v_up FROM public.mux_uploads WHERE upload_id = p_item->>'mux_upload_id';
  IF NOT FOUND OR v_up.user_id IS DISTINCT FROM p_owner THEN
    RAISE EXCEPTION 'post_video_not_owned' USING ERRCODE = '42501';
  END IF;
  v_base := public.post_mux_strip(p_item) || jsonb_build_object('provider','mux','type','video');
  IF v_up.status::text = 'ready' AND v_up.duration_rule_applies AND v_up.duration IS NOT NULL AND v_up.duration > 60 THEN
    RETURN v_base || jsonb_build_object('url','','mux_status','errored','mux_error','too_long','duration', v_up.duration)
      || COALESCE(CASE WHEN v_up.asset_id IS NOT NULL THEN jsonb_build_object('mux_asset_id', v_up.asset_id) END, '{}'::jsonb);
  ELSIF v_up.status::text = 'ready' AND v_up.playback_id IS NOT NULL AND v_up.asset_id IS NOT NULL THEN
    v_thumb := 'https://image.mux.com/' || v_up.playback_id || '/thumbnail.jpg';
    RETURN v_base || jsonb_build_object('mux_status','ready','mux_playback_id', v_up.playback_id, 'mux_asset_id', v_up.asset_id,
                                        'url', v_thumb, 'thumbnail_url', v_thumb)
      || COALESCE(CASE WHEN v_up.duration IS NOT NULL THEN jsonb_build_object('duration', v_up.duration) END, '{}'::jsonb)
      || COALESCE(CASE WHEN v_up.aspect_ratio IS NOT NULL THEN jsonb_build_object('aspect_ratio', v_up.aspect_ratio) END, '{}'::jsonb);
  ELSIF v_up.status::text IN ('errored','cancelled','ready') THEN
    RETURN v_base || jsonb_build_object('url','','mux_status','errored','mux_error', COALESCE(v_up.error, v_up.status::text))
      || COALESCE(CASE WHEN v_up.asset_id IS NOT NULL THEN jsonb_build_object('mux_asset_id', v_up.asset_id) END, '{}'::jsonb);
  END IF;
  RETURN v_base || jsonb_build_object('url','','mux_status','preparing');
END $$;
REVOKE ALL ON FUNCTION public.post_mux_truth_item(jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.post_mux_patch_is_valid(p_old jsonb, p_new jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  o jsonb := p_old->'media'; n jsonb := p_new->'media';
  i int; v_changed int := 0; oi jsonb; ni jsonb; v_expected jsonb;
BEGIN
  IF (p_old - 'media' - 'updated_at' - 'last_edited_at') IS DISTINCT FROM (p_new - 'media' - 'updated_at' - 'last_edited_at') THEN RETURN false; END IF;
  IF o IS NULL OR n IS NULL OR jsonb_typeof(o) <> 'array' OR jsonb_typeof(n) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(o) <> jsonb_array_length(n) THEN RETURN false; END IF;
  FOR i IN 0 .. jsonb_array_length(n) - 1 LOOP
    oi := o -> i; ni := n -> i;
    IF oi IS DISTINCT FROM ni THEN
      v_changed := v_changed + 1;
      IF v_changed > 1 THEN RETURN false; END IF;
      IF oi->>'type' <> 'video' OR COALESCE(oi->>'mux_upload_id','') = ''
         OR oi->>'mux_upload_id' IS DISTINCT FROM ni->>'mux_upload_id' THEN RETURN false; END IF;
      BEGIN
        v_expected := public.post_mux_truth_item(oi, (p_new->>'user_id')::uuid);
      EXCEPTION WHEN OTHERS THEN RETURN false;
      END;
      IF ni IS DISTINCT FROM v_expected THEN RETURN false; END IF;
      IF ni->>'mux_status' NOT IN ('ready','errored') THEN RETURN false; END IF;
    END IF;
  END LOOP;
  RETURN v_changed = 1;
END $$;
REVOKE ALL ON FUNCTION public.post_mux_patch_is_valid(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.posts_media_mux_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END $$;

DROP TRIGGER IF EXISTS zz_posts_media_mux_before ON public.posts;
CREATE TRIGGER zz_posts_media_mux_before BEFORE INSERT OR UPDATE OF media ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_media_mux_before();

CREATE OR REPLACE FUNCTION public.patch_content_media_from_mux(p_mapping_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_mapping public.mux_upload_mappings%ROWTYPE; v_upload public.mux_uploads%ROWTYPE;
  v_post_user_id uuid; v_media jsonb; v_item jsonb; v_patched_item jsonb;
  v_existing_uid text; v_existing_type text; v_existing_prov text; v_ct text;
BEGIN
  SELECT content_type INTO v_ct FROM public.mux_upload_mappings WHERE id = p_mapping_id;
  IF v_ct IN ('review','review_update') THEN RETURN public.patch_review_media_from_mux(p_mapping_id); END IF;

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

  IF v_mapping.content_type = 'post' THEN
    SELECT user_id, media INTO v_post_user_id, v_media FROM public.posts WHERE id = v_mapping.content_id FOR UPDATE;
  ELSE
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
$function$;