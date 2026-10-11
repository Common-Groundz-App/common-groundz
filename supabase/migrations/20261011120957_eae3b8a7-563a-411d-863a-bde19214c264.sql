DROP FUNCTION IF EXISTS public.remove_broken_review_video(text, uuid, text);

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
      RAISE EXCEPTION 'review_edit_window_closed' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP FUNCTION IF EXISTS public.review_media_is_broken_removal(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.mux_upload_is_broken(text);