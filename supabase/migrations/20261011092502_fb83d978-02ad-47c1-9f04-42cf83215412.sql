
ALTER TABLE public.mux_upload_mappings DROP CONSTRAINT mux_upload_mappings_content_type_check;
ALTER TABLE public.mux_upload_mappings ADD CONSTRAINT mux_upload_mappings_content_type_check
  CHECK (content_type = ANY (ARRAY['post','review','review_update']));

-- Trusted server context: no end-user JWT on this request (service role or direct DB job).
CREATE OR REPLACE FUNCTION public.is_trusted_server_context()
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_role text; v_claims text;
BEGIN
  v_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  IF v_role IS NULL THEN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '');
    IF v_claims IS NOT NULL THEN v_role := v_claims::jsonb->>'role'; END IF;
  END IF;
  RETURN auth.uid() IS NULL AND (v_role IS NULL OR v_role = 'service_role');
END $$;

CREATE OR REPLACE FUNCTION public.review_media_video_count(p_media jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE((SELECT count(*)::int FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_media) = 'array' THEN p_media ELSE '[]'::jsonb END) e
    WHERE e->>'type' = 'video'), 0)
$$;

CREATE OR REPLACE FUNCTION public.review_cover_from_media(p_media jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_first jsonb; v_photo text;
BEGIN
  IF p_media IS NULL OR jsonb_typeof(p_media) <> 'array' OR jsonb_array_length(p_media) = 0 THEN
    RETURN NULL;
  END IF;
  v_first := p_media -> 0;
  IF v_first->>'type' = 'video' THEN
    IF v_first->>'mux_status' = 'ready' AND COALESCE(v_first->>'mux_playback_id','') <> '' THEN
      RETURN 'https://image.mux.com/' || (v_first->>'mux_playback_id') || '/thumbnail.jpg';
    END IF;
    SELECT e->>'url' INTO v_photo FROM jsonb_array_elements(p_media) WITH ORDINALITY AS t(e, o)
     WHERE e->>'type' IS DISTINCT FROM 'video' AND COALESCE(e->>'url','') <> ''
     ORDER BY o LIMIT 1;
    RETURN v_photo;
  END IF;
  RETURN NULLIF(v_first->>'url', '');
END $$;

CREATE OR REPLACE FUNCTION public.review_mux_truth_item(p_item jsonb, p_owner uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_up public.mux_uploads%ROWTYPE; v_base jsonb;
BEGIN
  IF COALESCE(p_item->>'provider','') <> 'mux' OR COALESCE(p_item->>'mux_upload_id','') = '' THEN
    RAISE EXCEPTION 'review_video_invalid' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_up FROM public.mux_uploads WHERE upload_id = p_item->>'mux_upload_id';
  IF NOT FOUND OR v_up.user_id IS DISTINCT FROM p_owner THEN
    RAISE EXCEPTION 'review_video_not_owned' USING ERRCODE = '42501';
  END IF;
  v_base := p_item - 'mux_status' - 'mux_playback_id' - 'mux_asset_id' - 'mux_error' - 'duration' - 'aspect_ratio';
  IF v_up.status::text = 'ready' AND v_up.duration IS NOT NULL AND v_up.duration > 60 THEN
    RETURN v_base || jsonb_build_object('mux_status','errored','mux_error','too_long','duration', v_up.duration)
      || COALESCE(CASE WHEN v_up.asset_id IS NOT NULL THEN jsonb_build_object('mux_asset_id', v_up.asset_id) END, '{}'::jsonb);
  ELSIF v_up.status::text = 'ready' AND v_up.playback_id IS NOT NULL AND v_up.asset_id IS NOT NULL THEN
    RETURN v_base || jsonb_build_object('mux_status','ready','mux_playback_id', v_up.playback_id, 'mux_asset_id', v_up.asset_id)
      || COALESCE(CASE WHEN v_up.duration IS NOT NULL THEN jsonb_build_object('duration', v_up.duration) END, '{}'::jsonb)
      || COALESCE(CASE WHEN v_up.aspect_ratio IS NOT NULL THEN jsonb_build_object('aspect_ratio', v_up.aspect_ratio) END, '{}'::jsonb);
  ELSIF v_up.status::text IN ('errored','cancelled','ready') THEN
    RETURN v_base || jsonb_build_object('mux_status','errored','mux_error', COALESCE(v_up.error, v_up.status::text));
  END IF;
  RETURN v_base || jsonb_build_object('mux_status','preparing');
END $$;

CREATE OR REPLACE FUNCTION public.review_media_only_trusted_mux_changes(p_old jsonb, p_new jsonb, p_owner uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k int; o jsonb; n jsonb; v_changed int := 0;
  mux_keys text[] := ARRAY['mux_status','mux_playback_id','mux_asset_id','mux_error','duration','aspect_ratio'];
BEGIN
  IF jsonb_typeof(p_old) <> 'array' OR jsonb_typeof(p_new) <> 'array'
     OR jsonb_array_length(p_old) <> jsonb_array_length(p_new) THEN
    RETURN false;
  END IF;
  FOR k IN 0 .. jsonb_array_length(p_old) - 1 LOOP
    o := p_old -> k; n := p_new -> k;
    CONTINUE WHEN o = n;
    IF o->>'type' IS DISTINCT FROM 'video' OR n->>'type' IS DISTINCT FROM 'video'
       OR (o->>'mux_upload_id') IS DISTINCT FROM (n->>'mux_upload_id')
       OR (o - mux_keys) <> (n - mux_keys)
       OR n <> public.review_mux_truth_item(o, p_owner) THEN
      RETURN false;
    END IF;
    v_changed := v_changed + 1;
  END LOOP;
  RETURN v_changed <= 1;
END $$;

CREATE OR REPLACE FUNCTION public.mux_upload_is_broken(p_upload_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mux_uploads u WHERE u.upload_id = p_upload_id
    AND (u.status::text IN ('errored','cancelled') OR (u.status::text = 'ready' AND u.duration > 60)))
$$;

CREATE OR REPLACE FUNCTION public.review_media_is_broken_removal(p_old jsonb, p_new jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k int; v_len int;
BEGIN
  IF jsonb_typeof(p_old) <> 'array' OR jsonb_typeof(p_new) <> 'array' THEN RETURN false; END IF;
  v_len := jsonb_array_length(p_old);
  IF jsonb_array_length(p_new) <> v_len - 1 THEN RETURN false; END IF;
  FOR k IN 0 .. v_len - 1 LOOP
    IF (p_old - k) = p_new AND (p_old->k->>'type') = 'video'
       AND public.mux_upload_is_broken(p_old->k->>'mux_upload_id') THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END $$;

-- Internal patch allowed only from the trusted server, and only for the trusted Mux diff.
CREATE OR REPLACE FUNCTION public.review_mux_patch_is_valid(p_old jsonb, p_new jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.is_trusted_server_context()
     AND (p_old - 'media' - 'image_url' - 'updated_at') = (p_new - 'media' - 'image_url' - 'updated_at')
     AND public.review_media_only_trusted_mux_changes(p_old->'media', p_new->'media', (p_old->>'user_id')::uuid);
END $$;

CREATE OR REPLACE FUNCTION public.enforce_review_edit_window()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_system boolean := COALESCE(current_setting('app.review_system_write', true), 'off') = 'on';
  v_mux_patch boolean := COALESCE(current_setting('app.mux_review_patch', true), 'off') = 'on';
  v_author_change boolean;
BEGIN
  IF NEW.user_id   IS DISTINCT FROM OLD.user_id
     OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
     OR NEW.category  IS DISTINCT FROM OLD.category
     OR NEW.title     IS DISTINCT FROM OLD.title
     OR NEW.venue     IS DISTINCT FROM OLD.venue THEN
    RAISE EXCEPTION 'review_identity_locked' USING ERRCODE = '42501';
  END IF;

  IF v_mux_patch THEN
    IF public.review_mux_patch_is_valid(to_jsonb(OLD), to_jsonb(NEW)) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'mux_patch_invalid' USING ERRCODE = '42501';
  END IF;

  IF v_uid IS NULL OR v_system THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(NEW.metadata, '{}'::jsonb) - 'questionnaire' - 'food_tags')
     IS DISTINCT FROM (COALESCE(OLD.metadata, '{}'::jsonb) - 'questionnaire' - 'food_tags') THEN
    RAISE EXCEPTION 'review_metadata_locked' USING ERRCODE = '42501';
  END IF;

  IF NEW.latest_rating                IS DISTINCT FROM OLD.latest_rating
     OR NEW.timeline_count            IS DISTINCT FROM OLD.timeline_count
     OR NEW.has_timeline              IS DISTINCT FROM OLD.has_timeline
     OR NEW.is_recommended            IS DISTINCT FROM OLD.is_recommended
     OR NEW.trust_score               IS DISTINCT FROM OLD.trust_score
     OR NEW.is_verified               IS DISTINCT FROM OLD.is_verified
     OR NEW.ai_summary                IS DISTINCT FROM OLD.ai_summary
     OR NEW.ai_summary_last_generated_at IS DISTINCT FROM OLD.ai_summary_last_generated_at
     OR NEW.ai_summary_model_used     IS DISTINCT FROM OLD.ai_summary_model_used
     OR NEW.embedding                 IS DISTINCT FROM OLD.embedding
     OR NEW.embedding_updated_at      IS DISTINCT FROM OLD.embedding_updated_at
     OR NEW.created_at                IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'review_system_fields_locked' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(public.has_role(v_uid, 'admin'::public.app_role), false) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT COALESCE(public.has_role(v_uid, 'moderator'::public.app_role), false) THEN
    RAISE EXCEPTION 'review_status_locked' USING ERRCODE = '42501';
  END IF;

  v_author_change :=
       NEW.rating          IS DISTINCT FROM OLD.rating
    OR NEW.description     IS DISTINCT FROM OLD.description
    OR NEW.subtitle        IS DISTINCT FROM OLD.subtitle
    OR NEW.media           IS DISTINCT FROM OLD.media
    OR NEW.image_url       IS DISTINCT FROM OLD.image_url
    OR NEW.experience_date IS DISTINCT FROM OLD.experience_date
    OR (NEW.metadata->'questionnaire') IS DISTINCT FROM (OLD.metadata->'questionnaire')
    OR (NEW.metadata->'food_tags')     IS DISTINCT FROM (OLD.metadata->'food_tags');

  IF v_author_change THEN
    IF v_uid <> OLD.user_id THEN
      RAISE EXCEPTION 'not authorized to edit this review' USING ERRCODE = '42501';
    END IF;
    IF now() >= OLD.created_at + interval '1 hour' THEN
      IF NEW.rating          IS NOT DISTINCT FROM OLD.rating
         AND NEW.description IS NOT DISTINCT FROM OLD.description
         AND NEW.subtitle    IS NOT DISTINCT FROM OLD.subtitle
         AND NEW.experience_date IS NOT DISTINCT FROM OLD.experience_date
         AND NEW.visibility  IS NOT DISTINCT FROM OLD.visibility
         AND NEW.metadata    IS NOT DISTINCT FROM OLD.metadata
         AND public.review_media_is_broken_removal(OLD.media, NEW.media) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'review_edit_window_closed' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_media_mux_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type text := CASE WHEN TG_TABLE_NAME = 'reviews' THEN 'review' ELSE 'review_update' END;
  v_patch boolean := COALESCE(current_setting('app.mux_review_patch', true), 'off') = 'on';
  v_media_changed boolean;
  v_new jsonb := '[]'::jsonb;
  v_item jsonb;
  v_videos int;
  v_owner uuid;
  v_vis text;
  v_old_videos int := 0;
BEGIN
  IF v_patch THEN
    IF TG_OP <> 'UPDATE' OR NOT public.review_mux_patch_is_valid(to_jsonb(OLD), to_jsonb(NEW)) THEN
      RAISE EXCEPTION 'mux_patch_invalid' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := OLD.updated_at;
    IF v_type = 'review' THEN
      NEW.image_url := public.review_cover_from_media(NEW.media);
    END IF;
    RETURN NEW;
  END IF;

  v_media_changed := TG_OP = 'INSERT' OR NEW.media IS DISTINCT FROM OLD.media;
  IF TG_OP = 'UPDATE' THEN v_old_videos := public.review_media_video_count(OLD.media); END IF;

  IF v_media_changed AND NEW.media IS NOT NULL AND jsonb_typeof(NEW.media) = 'array' THEN
    IF jsonb_array_length(NEW.media) > 4 THEN
      RAISE EXCEPTION 'review_media_too_many' USING ERRCODE = '22023';
    END IF;
    v_videos := public.review_media_video_count(NEW.media);
    IF v_videos > 1 THEN
      RAISE EXCEPTION 'review_media_one_video' USING ERRCODE = '22023';
    END IF;

    IF v_videos > 0 THEN
      IF v_type = 'review' THEN
        v_vis := NEW.visibility::text;
      ELSE
        SELECT r.visibility::text, r.user_id INTO v_vis, v_owner
          FROM public.reviews r WHERE r.id = NEW.review_id FOR UPDATE;
        IF v_owner IS DISTINCT FROM NEW.user_id THEN
          RAISE EXCEPTION 'review_video_not_owned' USING ERRCODE = '42501';
        END IF;
      END IF;
      IF v_vis IS DISTINCT FROM 'public' THEN
        RAISE EXCEPTION 'review_video_public_only' USING ERRCODE = '22023';
      END IF;

      FOR v_item IN SELECT e FROM jsonb_array_elements(NEW.media) WITH ORDINALITY t(e, o) ORDER BY o LOOP
        IF v_item->>'type' = 'video' THEN
          IF EXISTS (SELECT 1 FROM public.mux_upload_mappings m
                      WHERE m.mux_upload_id = v_item->>'mux_upload_id'
                        AND (m.content_type <> v_type OR m.content_id <> NEW.id)) THEN
            RAISE EXCEPTION 'review_video_in_use' USING ERRCODE = '23505';
          END IF;
          v_item := public.review_mux_truth_item(v_item, NEW.user_id);
        END IF;
        v_new := v_new || jsonb_build_array(v_item);
      END LOOP;
      NEW.media := v_new;
    END IF;

    IF v_type = 'review' AND (v_videos > 0 OR v_old_videos > 0) THEN
      NEW.image_url := public.review_cover_from_media(NEW.media);
    END IF;
  END IF;

  IF v_type = 'review' AND TG_OP = 'UPDATE'
     AND NEW.visibility IS DISTINCT FROM OLD.visibility
     AND NEW.visibility::text <> 'public' THEN
    IF public.review_media_video_count(NEW.media) > 0
       OR EXISTS (SELECT 1 FROM public.review_updates u
                   WHERE u.review_id = NEW.id AND public.review_media_video_count(u.media) > 0) THEN
      RAISE EXCEPTION 'review_video_visibility_locked' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_review_mux_mappings(p_type text, p_id uuid, p_user uuid, p_media jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  PERFORM 1 FROM public.mux_upload_mappings
   WHERE content_type = p_type AND content_id = p_id FOR UPDATE;

  WITH items AS (
    SELECT e->>'mux_upload_id' AS uid
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_media) = 'array' THEN p_media ELSE '[]'::jsonb END) e
     WHERE e->>'type' = 'video' AND COALESCE(e->>'mux_upload_id','') <> '')
  UPDATE public.mux_upload_mappings m SET status = 'removed', last_error = NULL
   WHERE m.content_type = p_type AND m.content_id = p_id
     AND m.status IN ('pending','patched','errored')
     AND m.mux_upload_id NOT IN (SELECT uid FROM items);

  UPDATE public.mux_upload_mappings m SET media_index = 1000000 + s.rn
    FROM (SELECT id, row_number() OVER (ORDER BY id) rn FROM public.mux_upload_mappings
           WHERE content_type = p_type AND content_id = p_id AND status IN ('pending','patched','errored')) s
   WHERE m.id = s.id;

  FOR r IN
    SELECT e->>'mux_upload_id' AS uid, (o - 1)::int AS idx, e->>'mux_status' AS st
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_media) = 'array' THEN p_media ELSE '[]'::jsonb END)
           WITH ORDINALITY t(e, o)
     WHERE e->>'type' = 'video' AND COALESCE(e->>'mux_upload_id','') <> ''
  LOOP
    UPDATE public.mux_upload_mappings m
       SET media_index = r.idx,
           status = CASE WHEN r.st IN ('ready','errored') THEN 'patched' ELSE 'pending' END,
           patched_at = CASE WHEN r.st IN ('ready','errored') THEN COALESCE(m.patched_at, now()) ELSE NULL END,
           mux_status_snapshot = r.st,
           last_error = NULL
     WHERE m.mux_upload_id = r.uid AND m.content_type = p_type AND m.content_id = p_id;
    IF NOT FOUND THEN
      INSERT INTO public.mux_upload_mappings
        (mux_upload_id, content_type, content_id, media_index, user_id, status, patched_at, mux_status_snapshot)
      VALUES (r.uid, p_type, p_id, r.idx, p_user,
              CASE WHEN r.st IN ('ready','errored') THEN 'patched' ELSE 'pending' END,
              CASE WHEN r.st IN ('ready','errored') THEN now() END, r.st);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.review_media_mux_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text := CASE WHEN TG_TABLE_NAME = 'reviews' THEN 'review' ELSE 'review_update' END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.mux_upload_mappings SET status = 'removed', last_error = 'content_deleted'
     WHERE content_type = v_type AND content_id = OLD.id AND status IN ('pending','patched','errored');
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.media IS NOT DISTINCT FROM OLD.media THEN RETURN NULL; END IF;
  IF public.review_media_video_count(NEW.media) = 0
     AND (TG_OP = 'INSERT' OR public.review_media_video_count(OLD.media) = 0) THEN
    RETURN NULL;
  END IF;
  PERFORM public.sync_review_mux_mappings(v_type, NEW.id, NEW.user_id, NEW.media);
  RETURN NULL;
END $$;

CREATE TRIGGER zz_review_media_mux_before BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.review_media_mux_before();
CREATE TRIGGER zz_review_media_mux_before BEFORE INSERT OR UPDATE ON public.review_updates
  FOR EACH ROW EXECUTE FUNCTION public.review_media_mux_before();
CREATE TRIGGER zz_review_media_mux_after AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.review_media_mux_after();
CREATE TRIGGER zz_review_media_mux_after AFTER INSERT OR UPDATE OR DELETE ON public.review_updates
  FOR EACH ROW EXECUTE FUNCTION public.review_media_mux_after();

CREATE OR REPLACE FUNCTION public.patch_review_media_from_mux(p_mapping_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_m public.mux_upload_mappings%ROWTYPE;
  v_up public.mux_uploads%ROWTYPE;
  v_owner uuid; v_media jsonb; v_idx int; v_item jsonb;
BEGIN
  IF NOT public.is_trusted_server_context() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_m FROM public.mux_upload_mappings WHERE id = p_mapping_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'mapping_not_found'; END IF;

  IF v_m.content_type = 'review' THEN
    SELECT user_id, media INTO v_owner, v_media FROM public.reviews WHERE id = v_m.content_id FOR UPDATE;
  ELSE
    SELECT user_id, media INTO v_owner, v_media FROM public.review_updates WHERE id = v_m.content_id FOR UPDATE;
  END IF;

  SELECT * INTO v_m FROM public.mux_upload_mappings WHERE id = p_mapping_id FOR UPDATE;
  IF v_m.status = 'removed'  THEN RETURN 'noop_removed'; END IF;
  IF v_m.status = 'patched'  THEN RETURN 'noop_already_patched'; END IF;
  IF v_m.status = 'orphaned' THEN RETURN 'noop_orphaned'; END IF;
  IF v_m.status = 'errored'  THEN RETURN 'noop_errored'; END IF;

  SELECT * INTO v_up FROM public.mux_uploads WHERE upload_id = v_m.mux_upload_id;
  IF NOT FOUND OR v_up.status::text NOT IN ('ready','errored') THEN RETURN 'noop_not_ready'; END IF;

  IF v_owner IS NULL THEN
    UPDATE public.mux_upload_mappings SET status = 'removed', last_error = 'content_not_found' WHERE id = v_m.id;
    RETURN 'noop_removed';
  END IF;
  IF v_owner IS DISTINCT FROM v_m.user_id OR v_up.user_id IS DISTINCT FROM v_m.user_id THEN
    UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'ownership_mismatch' WHERE id = v_m.id;
    RETURN 'orphaned';
  END IF;

  SELECT (o - 1)::int INTO v_idx FROM jsonb_array_elements(v_media) WITH ORDINALITY t(e, o)
   WHERE e->>'mux_upload_id' = v_m.mux_upload_id AND e->>'type' = 'video' LIMIT 1;
  IF v_idx IS NULL THEN
    UPDATE public.mux_upload_mappings SET status = 'removed', last_error = 'slot_gone' WHERE id = v_m.id;
    RETURN 'noop_removed';
  END IF;

  v_item := public.review_mux_truth_item(v_media -> v_idx, v_owner);
  IF v_item <> (v_media -> v_idx) THEN
    v_media := jsonb_set(v_media, ARRAY[v_idx::text], v_item, false);
    PERFORM set_config('app.mux_review_patch', 'on', true);
    IF v_m.content_type = 'review' THEN
      UPDATE public.reviews SET media = v_media WHERE id = v_m.content_id;
    ELSE
      UPDATE public.review_updates SET media = v_media WHERE id = v_m.content_id;
    END IF;
    PERFORM set_config('app.mux_review_patch', 'off', true);
  END IF;

  UPDATE public.mux_upload_mappings
     SET status = 'patched', mux_status_snapshot = v_up.status::text, patched_at = now(), last_error = NULL
   WHERE id = v_m.id;
  RETURN 'patched';
END $$;

CREATE OR REPLACE FUNCTION public.patch_content_media_from_mux(p_mapping_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  v_ct            text;
BEGIN
  SELECT content_type INTO v_ct FROM public.mux_upload_mappings WHERE id = p_mapping_id;
  IF v_ct IN ('review','review_update') THEN
    RETURN public.patch_review_media_from_mux(p_mapping_id);
  END IF;

  SELECT * INTO v_mapping FROM public.mux_upload_mappings WHERE id = p_mapping_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mapping_not_found'; END IF;

  IF v_mapping.status = 'patched'  THEN RETURN 'noop_already_patched'; END IF;
  IF v_mapping.status = 'orphaned' THEN RETURN 'noop_orphaned';        END IF;
  IF v_mapping.status = 'errored'  THEN RETURN 'noop_errored';         END IF;
  IF v_mapping.status = 'removed'  THEN RETURN 'noop_removed';         END IF;

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
  v_existing_uid  := v_item ->> 'mux_upload_id';
  v_existing_type := v_item ->> 'type';
  v_existing_prov := v_item ->> 'provider';

  IF v_existing_uid IS DISTINCT FROM v_mapping.mux_upload_id OR v_existing_type <> 'video' OR v_existing_prov <> 'mux' THEN
    UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'slot_mismatch' WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_upload.status::text = 'ready' THEN
    IF v_upload.asset_id IS NULL THEN
      UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'ready_without_asset_id' WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;
    IF v_upload.playback_id IS NULL THEN
      UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'ready_without_playback_id' WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;
    v_patched_item := v_item
      || jsonb_build_object('mux_asset_id', v_upload.asset_id, 'mux_playback_id', v_upload.playback_id, 'mux_status', 'ready')
      || COALESCE(CASE WHEN v_upload.duration IS NOT NULL THEN jsonb_build_object('duration', v_upload.duration) END, '{}'::jsonb)
      || COALESCE(CASE WHEN v_upload.aspect_ratio IS NOT NULL THEN jsonb_build_object('aspect_ratio', v_upload.aspect_ratio) END, '{}'::jsonb);
  ELSE
    v_patched_item := v_item
      || jsonb_build_object('mux_status', 'errored', 'mux_error', COALESCE(v_upload.error, 'unknown'))
      || COALESCE(CASE WHEN v_upload.asset_id IS NOT NULL THEN jsonb_build_object('mux_asset_id', v_upload.asset_id) END, '{}'::jsonb);
  END IF;

  v_media := jsonb_set(v_media, ARRAY[v_mapping.media_index::text], v_patched_item, false);
  PERFORM set_config('app.mux_system_patch', 'on', true);
  UPDATE public.posts SET media = v_media WHERE id = v_mapping.content_id;
  UPDATE public.mux_upload_mappings
     SET status = 'patched', mux_status_snapshot = v_upload.status::text, patched_at = now(), last_error = NULL
   WHERE id = v_mapping.id;
  RETURN 'patched';
END;
$function$;

-- Owner-only removal of a broken video. review_updates has no direct-update policy
-- and no edit-window trigger (the window lives in edit_latest_review_update), so this
-- SECURITY DEFINER function is the only path and is allowed past the hour by design.
CREATE OR REPLACE FUNCTION public.remove_broken_review_video(p_content_type text, p_content_id uuid, p_mux_upload_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_owner uuid; v_media jsonb; v_idx int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  IF p_content_type NOT IN ('review','review_update') THEN
    RAISE EXCEPTION 'invalid content type' USING ERRCODE = '22023';
  END IF;
  IF p_content_type = 'review' THEN
    SELECT user_id, media INTO v_owner, v_media FROM public.reviews WHERE id = p_content_id FOR UPDATE;
  ELSE
    SELECT user_id, media INTO v_owner, v_media FROM public.review_updates WHERE id = p_content_id FOR UPDATE;
  END IF;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF v_owner <> v_uid THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mux_upload_mappings m
                  WHERE m.mux_upload_id = p_mux_upload_id AND m.content_type = p_content_type
                    AND m.content_id = p_content_id AND m.status IN ('pending','patched','errored')) THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;
  IF NOT public.mux_upload_is_broken(p_mux_upload_id) THEN
    RETURN jsonb_build_object('status','not_broken');
  END IF;
  SELECT (o - 1)::int INTO v_idx FROM jsonb_array_elements(v_media) WITH ORDINALITY t(e, o)
   WHERE e->>'mux_upload_id' = p_mux_upload_id LIMIT 1;
  IF v_idx IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;

  IF p_content_type = 'review' THEN
    UPDATE public.reviews SET media = v_media - v_idx WHERE id = p_content_id;
  ELSE
    UPDATE public.review_updates SET media = v_media - v_idx WHERE id = p_content_id;
  END IF;
  RETURN jsonb_build_object('status','ok');
END $$;

REVOKE ALL ON FUNCTION public.is_trusted_server_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_mux_truth_item(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_media_only_trusted_mux_changes(jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_mux_patch_is_valid(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mux_upload_is_broken(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_media_is_broken_removal(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_review_mux_mappings(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patch_review_media_from_mux(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patch_content_media_from_mux(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_media_mux_before() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_media_mux_after() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_content_media_from_mux(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.patch_review_media_from_mux(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.remove_broken_review_video(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_broken_review_video(text, uuid, text) TO authenticated;
