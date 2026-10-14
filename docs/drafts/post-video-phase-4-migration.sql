-- Post video Phase 4 Step 2 — stable Post media IDs. REVIEW DRAFT: not run.
-- Rollout: run this migration, then deploy mux-sync-post-mappings and
-- mux-register-mappings (drafts in docs/drafts/). Old function versions stay
-- safe in between (old sync: client list ignored; old register: its direct
-- insert is refused, the save already created the link).

-- 1. Canonical own-storage key and media identity --------------------------
CREATE OR REPLACE FUNCTION public.post_media_storage_key(p_url text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $f$
  SELECT CASE WHEN p_url ~ '^https://uyjtgybbktgapspodajy\.supabase\.co/storage/v1/object/(public|sign)/[^/?#]+/[^?#]+'
    THEN regexp_replace(split_part(split_part(p_url,'?',1),'#',1),
           '^https://uyjtgybbktgapspodajy\.supabase\.co/storage/v1/object/(public|sign)/','') END;
$f$;

CREATE OR REPLACE FUNCTION public.post_media_identity(p_item jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $f$
  SELECT CASE
    WHEN jsonb_typeof(p_item) IS DISTINCT FROM 'object' THEN NULL
    WHEN coalesce(p_item->>'mux_upload_id','') <> '' THEN 'mux:' || (p_item->>'mux_upload_id')
    WHEN public.post_media_storage_key(p_item->>'url') IS NOT NULL THEN 'file:' || public.post_media_storage_key(p_item->>'url')
  END;
$f$;

-- 2. ID rule -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_media_assign_ids(p_old jsonb, p_new jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path TO 'public' AS $f$
DECLARE
  v_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_old jsonb := CASE WHEN jsonb_typeof(p_old) = 'array' THEN p_old ELSE '[]'::jsonb END;
  v_out jsonb := '[]'::jsonb; v_item jsonb; v_ident text; v_id text; v_saved text; v_cnt int;
  v_unchanged boolean;
BEGIN
  IF jsonb_typeof(p_new) IS DISTINCT FROM 'array' THEN RETURN p_new; END IF;

  FOR v_item IN SELECT t.e FROM jsonb_array_elements(p_new) WITH ORDINALITY t(e,o) ORDER BY t.o LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN v_out := v_out || jsonb_build_array(v_item); CONTINUE; END IF;
    v_ident := public.post_media_identity(v_item);
    v_id := v_item->>'id';
    v_unchanged := EXISTS (SELECT 1 FROM jsonb_array_elements(v_old) o
                            WHERE jsonb_typeof(o) = 'object' AND (o - 'order') = (v_item - 'order'));
    v_cnt := 0; v_saved := NULL;
    IF v_ident IS NOT NULL THEN
      SELECT count(*), min(o->>'id') INTO v_cnt, v_saved FROM jsonb_array_elements(v_old) o
       WHERE public.post_media_identity(o) = v_ident;
    END IF;

    IF v_cnt = 1 AND coalesce(v_saved,'') ~* v_re THEN
      -- existing item: saved ID wins (byte-identical, keeps historical case)
      IF v_id IS DISTINCT FROM v_saved THEN v_item := v_item || jsonb_build_object('id', v_saved); END IF;
    ELSIF v_cnt >= 1 THEN
      -- ambiguous history: only an unchanged item may pass, never guessed
      IF NOT v_unchanged THEN RAISE EXCEPTION 'post_media_identity_ambiguous' USING ERRCODE = '22023'; END IF;
    ELSIF v_ident IS NULL AND v_unchanged THEN
      NULL; -- untouched item without identity
    ELSE
      -- brand-new item: keep a valid client UUID unless a saved item already owns it
      IF NOT (coalesce(v_id,'') ~* v_re)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_old) o WHERE lower(o->>'id') = lower(v_id)) THEN
        v_item := v_item || jsonb_build_object('id', gen_random_uuid()::text);
      END IF;
    END IF;
    v_out := v_out || jsonb_build_array(v_item);
  END LOOP;

  -- duplicates by actual ID (case-insensitive): allowed only as unchanged
  -- grandfathered copies, counted per copy (order ignored). Removing a copy is
  -- fine; repeating one copy ([A,B] -> [A,A]) or adding a copy is refused.
  IF EXISTS (
    SELECT 1
      FROM (SELECT lower(e->>'id') AS k
              FROM jsonb_array_elements(v_out) e
             WHERE jsonb_typeof(e) = 'object' AND coalesce(e->>'id','') <> ''
             GROUP BY 1 HAVING count(*) > 1) d
      CROSS JOIN LATERAL (
        SELECT (e - 'order') AS body, count(*) AS n
          FROM jsonb_array_elements(v_out) e
         WHERE jsonb_typeof(e) = 'object' AND lower(e->>'id') = d.k
         GROUP BY 1) nw
     WHERE nw.n > (SELECT count(*) FROM jsonb_array_elements(v_old) o
                    WHERE jsonb_typeof(o) = 'object' AND (o - 'order') = nw.body)
  ) THEN
    RAISE EXCEPTION 'post_media_duplicate_id' USING ERRCODE = '22023';
  END IF;
  RETURN v_out;
END $f$;

REVOKE EXECUTE ON FUNCTION public.post_media_storage_key(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_media_identity(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_media_assign_ids(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_media_storage_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_media_identity(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_media_assign_ids(jsonb, jsonb) TO service_role;

-- 3. BEFORE trigger: live definition + one line (marked NEW) -----------------
CREATE OR REPLACE FUNCTION public.posts_media_mux_before()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  NEW.media := public.post_media_assign_ids(v_old, NEW.media);   -- NEW (Phase 4)

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
END $function$;

-- 4. media_id on links; required for every new Post link ---------------------
ALTER TABLE public.mux_upload_mappings ADD COLUMN IF NOT EXISTS media_id uuid;

CREATE OR REPLACE FUNCTION public.mux_mapping_require_media_id()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $f$
BEGIN
  IF NEW.content_type = 'post' AND NEW.media_id IS NULL THEN
    RAISE EXCEPTION 'post_mapping_media_id_required' USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END $f$;
REVOKE EXECUTE ON FUNCTION public.mux_mapping_require_media_id() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mux_mapping_require_media_id ON public.mux_upload_mappings;
CREATE TRIGGER mux_mapping_require_media_id BEFORE INSERT ON public.mux_upload_mappings
FOR EACH ROW EXECUTE FUNCTION public.mux_mapping_require_media_id();

-- 5. Link items carry media_id (lowercase UUID or NULL) ----------------------
CREATE OR REPLACE FUNCTION public.post_mux_link_items(p_post_id uuid, p_media jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'mux_upload_id', e.item->>'mux_upload_id',
           'media_index', e.idx - 1,
           'media_id', CASE WHEN e.item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                            THEN lower(e.item->>'id') END) ORDER BY e.idx), '[]'::jsonb)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_media)='array' THEN p_media ELSE '[]'::jsonb END) WITH ORDINALITY e(item, idx)
   WHERE e.item->>'type'='video' AND e.item->>'provider'='mux' AND coalesce(e.item->>'mux_upload_id','') <> ''
     AND (EXISTS (SELECT 1 FROM public.mux_upload_mappings m WHERE m.content_type='post' AND m.content_id=p_post_id AND m.mux_upload_id=e.item->>'mux_upload_id')
          OR EXISTS (SELECT 1 FROM public.mux_uploads u WHERE u.upload_id=e.item->>'mux_upload_id' AND u.duration_rule_applies));
$function$;
REVOKE EXECUTE ON FUNCTION public.post_mux_link_items(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_mux_link_items(uuid, jsonb) TO service_role;

-- 6. Core sync: Phase 3 definition + media_id (lines marked NEW) --------------
CREATE OR REPLACE FUNCTION public.sync_mux_post_mappings_core(p_content_id uuid, p_items jsonb, p_patch boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    v_items := v_items || jsonb_build_array(jsonb_build_object('mux_upload_id', v_uid, 'media_index', v_target_idx,
                                                               'media_id', v_item ->> 'media_id'));   -- NEW
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
     SET status='pending', media_index=(s->>'media_index')::int, last_error=NULL, retry_count=0, patched_at=NULL,
         media_id=(s->>'media_id')::uuid                                                              -- NEW
    FROM jsonb_array_elements(v_items) s
   WHERE m.content_type='post' AND m.content_id=p_content_id AND m.mux_upload_id = s->>'mux_upload_id' AND m.status='removed';

  FOR v_item IN SELECT s FROM jsonb_array_elements(v_items) s
     WHERE NOT EXISTS (SELECT 1 FROM public.mux_upload_mappings m
                        WHERE m.content_type='post' AND m.content_id=p_content_id AND m.mux_upload_id = s->>'mux_upload_id')
  LOOP
    v_uid := v_item ->> 'mux_upload_id';
    v_target_idx := (v_item ->> 'media_index')::int;
    BEGIN
      INSERT INTO public.mux_upload_mappings (mux_upload_id, content_type, content_id, media_index, user_id, media_id)   -- NEW col
      SELECT v_uid, 'post', p_content_id, v_target_idx, p.user_id, (v_item ->> 'media_id')::uuid FROM public.posts p WHERE p.id = p_content_id;
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
       AND (m.media_id IS NULL OR lower(p.media -> m.media_index ->> 'id') = m.media_id::text)   -- NEW (Phase 4)
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
END $function$;
REVOKE EXECUTE ON FUNCTION public.sync_mux_post_mappings_core(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_mux_post_mappings_core(uuid, jsonb, boolean) TO service_role;

-- 7. Legacy wrapper: derives from the locked saved Post, client items ignored -
CREATE OR REPLACE FUNCTION public.sync_mux_post_mappings(p_content_id uuid, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_media jsonb; v_deleted boolean; v_found boolean;
BEGIN
  SELECT media, is_deleted, true INTO v_media, v_deleted, v_found
    FROM public.posts WHERE id = p_content_id FOR UPDATE;
  IF v_found IS NOT TRUE OR v_deleted IS TRUE THEN
    UPDATE public.mux_upload_mappings SET status='removed', last_error='content_deleted'
     WHERE content_type='post' AND content_id=p_content_id AND status IN ('pending','patched','errored');
    RETURN jsonb_build_object('results','[]'::jsonb, 'post', CASE WHEN v_found IS TRUE THEN 'deleted' ELSE 'missing' END);
  END IF;
  RETURN public.sync_mux_post_mappings_core(p_content_id, public.post_mux_link_items(p_content_id, v_media), true);
END $function$;
REVOKE EXECUTE ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_mux_post_mappings(uuid, jsonb) TO service_role;

-- 8. Mux patch: Phase 3 definition + media_id lookup (block marked NEW) -------
CREATE OR REPLACE FUNCTION public.patch_content_media_from_mux(p_mapping_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_mapping public.mux_upload_mappings%ROWTYPE; v_upload public.mux_uploads%ROWTYPE;
  v_post_user_id uuid; v_media jsonb; v_item jsonb; v_patched_item jsonb;
  v_existing_uid text; v_existing_type text; v_existing_prov text; v_ct text;
  v_content_id uuid; v_idx int;
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

  -- NEW (Phase 4): links with media_id find their item by ID; media_index is only a hint.
  IF v_mapping.media_id IS NOT NULL THEN
    SELECT (t.o - 1)::int INTO v_idx FROM jsonb_array_elements(v_media) WITH ORDINALITY t(e,o)
     WHERE lower(t.e->>'id') = v_mapping.media_id::text LIMIT 1;
    IF v_idx IS NULL THEN
      UPDATE public.mux_upload_mappings SET status = 'orphaned', last_error = 'media_id_not_found' WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;
    v_mapping.media_index := v_idx;
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
