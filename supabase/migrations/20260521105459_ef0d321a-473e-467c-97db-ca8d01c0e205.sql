
-- ===========================================================
-- Phase 3A: mux_upload_mappings + patch_content_media_from_mux
-- ===========================================================

CREATE TABLE public.mux_upload_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mux_upload_id text NOT NULL UNIQUE
    REFERENCES public.mux_uploads(upload_id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post')),
  content_id uuid NOT NULL,
  media_index integer NOT NULL CHECK (media_index >= 0),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','patched','orphaned','errored')),
  mux_status_snapshot text,
  patched_at timestamptz,
  last_error text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mux_upload_mappings_slot_unique
    UNIQUE (content_type, content_id, media_index)
);

CREATE INDEX idx_mux_upload_mappings_content
  ON public.mux_upload_mappings (content_type, content_id);
CREATE INDEX idx_mux_upload_mappings_user
  ON public.mux_upload_mappings (user_id);
CREATE INDEX idx_mux_upload_mappings_pending
  ON public.mux_upload_mappings (status) WHERE status = 'pending';

CREATE TRIGGER trg_mux_upload_mappings_updated_at
  BEFORE UPDATE ON public.mux_upload_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.mux_upload_mappings ENABLE ROW LEVEL SECURITY;
-- No policies: service_role bypasses RLS; all access is via edge functions.

-- ===========================================================
-- RPC: patch_content_media_from_mux
-- ===========================================================
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

  -- Terminal-state noops (deterministic for requeue)
  IF v_mapping.status = 'patched'  THEN RETURN 'noop_already_patched'; END IF;
  IF v_mapping.status = 'orphaned' THEN RETURN 'noop_orphaned';        END IF;
  IF v_mapping.status = 'errored'  THEN RETURN 'noop_errored';         END IF;

  -- Load Mux upload row
  SELECT * INTO v_upload
    FROM public.mux_uploads
   WHERE upload_id = v_mapping.mux_upload_id;

  IF NOT FOUND THEN
    RETURN 'noop_not_ready';
  END IF;

  IF v_upload.status::text NOT IN ('ready','errored') THEN
    RETURN 'noop_not_ready';
  END IF;

  -- Defense-in-depth: Mux upload must belong to the same user as the mapping
  IF v_upload.user_id IS DISTINCT FROM v_mapping.user_id THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned',
           last_error = 'ownership_mismatch'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  -- Lock the target post row, capture owner + media
  IF v_mapping.content_type = 'post' THEN
    SELECT user_id, media INTO v_post_user_id, v_media
      FROM public.posts
     WHERE id = v_mapping.content_id
     FOR UPDATE;
  ELSE
    -- Constraint currently restricts content_type to 'post'.
    RAISE EXCEPTION 'unsupported_content_type:%', v_mapping.content_type;
  END IF;

  IF v_post_user_id IS NULL THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned',
           last_error = 'content_not_found'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_post_user_id IS DISTINCT FROM v_mapping.user_id THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned',
           last_error = 'ownership_mismatch'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_media IS NULL OR jsonb_typeof(v_media) <> 'array' THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned',
           last_error = 'media_array_missing'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  IF v_mapping.media_index >= jsonb_array_length(v_media) THEN
    UPDATE public.mux_upload_mappings
       SET status = 'orphaned',
           last_error = 'media_index_out_of_range'
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
       SET status = 'orphaned',
           last_error = 'slot_mismatch'
     WHERE id = v_mapping.id;
    RETURN 'orphaned';
  END IF;

  -- Build the patched item
  IF v_upload.status::text = 'ready' THEN
    -- Integrity guards: never write null asset_id / playback_id and call it patched
    IF v_upload.asset_id IS NULL THEN
      UPDATE public.mux_upload_mappings
         SET status = 'orphaned',
             last_error = 'ready_without_asset_id'
       WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;
    IF v_upload.playback_id IS NULL THEN
      UPDATE public.mux_upload_mappings
         SET status = 'orphaned',
             last_error = 'ready_without_playback_id'
       WHERE id = v_mapping.id;
      RETURN 'orphaned';
    END IF;

    v_patched_item := v_item
      || jsonb_build_object(
           'mux_asset_id',    v_upload.asset_id,
           'mux_playback_id', v_upload.playback_id,
           'mux_status',      'ready'
         )
      || COALESCE(
           CASE WHEN v_upload.duration IS NOT NULL
                THEN jsonb_build_object('duration', v_upload.duration) END,
           '{}'::jsonb)
      || COALESCE(
           CASE WHEN v_upload.aspect_ratio IS NOT NULL
                THEN jsonb_build_object('aspect_ratio', v_upload.aspect_ratio) END,
           '{}'::jsonb);
  ELSE
    -- errored
    v_patched_item := v_item
      || jsonb_build_object(
           'mux_status', 'errored',
           'mux_error',  COALESCE(v_upload.error, 'unknown')
         )
      || COALESCE(
           CASE WHEN v_upload.asset_id IS NOT NULL
                THEN jsonb_build_object('mux_asset_id', v_upload.asset_id) END,
           '{}'::jsonb);
  END IF;

  v_media := jsonb_set(v_media, ARRAY[v_mapping.media_index::text], v_patched_item, false);

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
