
CREATE OR REPLACE FUNCTION public.review_media_mux_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type text := CASE WHEN TG_TABLE_NAME = 'reviews' THEN 'review' ELSE 'review_update' END;
  v_patch boolean := COALESCE(current_setting('app.mux_review_patch', true), 'off') = 'on';
  v_media_changed boolean;
  v_new jsonb := '[]'::jsonb;
  v_item jsonb;
  v_videos int := 0;
  v_owner uuid;
  v_vis text;
  v_rev_id uuid;
BEGIN
  IF v_patch THEN
    IF TG_OP <> 'UPDATE' OR NOT public.review_mux_patch_is_valid(to_jsonb(OLD), to_jsonb(NEW)) THEN
      RAISE EXCEPTION 'mux_patch_invalid' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := OLD.updated_at;
    IF v_type = 'review' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('image_url', public.review_cover_from_media(NEW.media)));
    END IF;
    RETURN NEW;
  END IF;

  v_media_changed := TG_OP = 'INSERT' OR NEW.media IS DISTINCT FROM OLD.media;

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
        v_vis := to_jsonb(NEW)->>'visibility';
      ELSE
        v_rev_id := (to_jsonb(NEW)->>'review_id')::uuid;
        SELECT r.visibility::text, r.user_id INTO v_vis, v_owner
          FROM public.reviews r WHERE r.id = v_rev_id FOR UPDATE;
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
  END IF;

  -- Cover always follows the current first item whenever review media changes
  -- (NULL / [] / removal / reorder / photo <-> video).
  IF v_type = 'review' AND v_media_changed THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('image_url', public.review_cover_from_media(NEW.media)));
  END IF;

  IF v_type = 'review' AND TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW)->>'visibility') IS DISTINCT FROM (to_jsonb(OLD)->>'visibility')
       AND (to_jsonb(NEW)->>'visibility') <> 'public' THEN
      IF public.review_media_video_count(NEW.media) > 0
         OR EXISTS (SELECT 1 FROM public.review_updates u
                     WHERE u.review_id = NEW.id AND public.review_media_video_count(u.media) > 0) THEN
        RAISE EXCEPTION 'review_video_visibility_locked' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.review_media_mux_before() FROM PUBLIC, anon, authenticated;
