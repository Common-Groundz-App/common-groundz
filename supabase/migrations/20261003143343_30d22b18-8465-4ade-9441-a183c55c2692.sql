-- Step 2: review edit window, timeline-update edit (owners only), atomic thread delete.
-- System-derived review fields are writable only by trusted database code, which
-- marks its own transaction with app.review_system_write (not settable via the API).
-- is_recommended/trust_score are always re-derived by reviews_apply_recommendation_trigger
-- on every UPDATE (reads latest timeline would_recommend + effective rating).
-- Subject identity (entity_id, category, title, venue) is immutable for ALL reviews;
-- relinking legacy reviews must be a separate deliberate migration.

CREATE OR REPLACE FUNCTION public.recompute_review_timeline_state(p_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
  v_latest numeric;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.review_updates WHERE review_id = p_review_id;

  SELECT u.rating INTO v_latest
  FROM public.review_updates u
  WHERE u.review_id = p_review_id AND u.rating IS NOT NULL
  ORDER BY u.created_at DESC, u.id DESC
  LIMIT 1;

  PERFORM set_config('app.review_system_write', 'on', true);
  UPDATE public.reviews
  SET timeline_count = v_count,
      has_timeline   = (v_count > 0),
      latest_rating  = v_latest,
      updated_at     = now()
  WHERE id = p_review_id;
  PERFORM set_config('app.review_system_write', 'off', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_review_edit_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_system boolean := COALESCE(current_setting('app.review_system_write', true), 'off') = 'on';
  v_author_change boolean;
BEGIN
  -- Author and subject are immutable for every writer and every review.
  IF NEW.user_id   IS DISTINCT FROM OLD.user_id
     OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
     OR NEW.category  IS DISTINCT FROM OLD.category
     OR NEW.title     IS DISTINCT FROM OLD.title
     OR NEW.venue     IS DISTINCT FROM OLD.venue THEN
    RAISE EXCEPTION 'review_identity_locked' USING ERRCODE = '42501';
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
$$;

DROP TRIGGER IF EXISTS reviews_enforce_edit_window ON public.reviews;
DROP TRIGGER IF EXISTS reviews_00_enforce_edit_window ON public.reviews;
CREATE TRIGGER reviews_00_enforce_edit_window
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_review_edit_window();

REVOKE EXECUTE ON FUNCTION public.enforce_review_edit_window() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.edit_latest_review_update(
  p_review_id uuid, p_update_id uuid, p_rating integer,
  p_comment text, p_media jsonb, p_would_recommend text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_latest uuid;
  v_created timestamptz;
  v_rows integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  IF p_review_id IS NULL OR p_update_id IS NULL THEN
    RAISE EXCEPTION 'review id and update id are required' USING ERRCODE = '22023';
  END IF;
  IF p_comment IS NULL OR btrim(p_comment) = '' THEN
    RAISE EXCEPTION 'comment is required' USING ERRCODE = '22023';
  END IF;
  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
    RAISE EXCEPTION 'rating must be between 1 and 5' USING ERRCODE = '22023';
  END IF;
  IF p_media IS NOT NULL AND jsonb_typeof(p_media) <> 'array' THEN
    RAISE EXCEPTION 'media must be a list' USING ERRCODE = '22023';
  END IF;
  IF p_would_recommend IS NOT NULL AND p_would_recommend NOT IN ('yes','no','maybe') THEN
    RAISE EXCEPTION 'invalid recommending choice' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_owner FROM public.reviews WHERE id = p_review_id;
  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  PERFORM pg_advisory_xact_lock(public.review_timeline_lock_key(p_review_id));

  SELECT u.id, u.created_at INTO v_latest, v_created
  FROM public.review_updates u
  WHERE u.review_id = p_review_id
  ORDER BY u.created_at DESC, u.id DESC
  LIMIT 1;

  IF v_latest IS NULL OR v_latest <> p_update_id THEN
    RETURN jsonb_build_object('status', 'not_latest', 'latestUpdateId', v_latest);
  END IF;
  IF now() >= v_created + interval '1 hour' THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  UPDATE public.review_updates
     SET rating = p_rating, comment = p_comment,
         media = COALESCE(p_media, '[]'::jsonb),
         would_recommend = p_would_recommend, updated_at = now()
   WHERE id = v_latest AND review_id = p_review_id AND user_id = v_uid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RETURN jsonb_build_object('status', 'conflict');
  END IF;

  PERFORM public.recompute_review_timeline_state(p_review_id);
  RETURN jsonb_build_object('status', 'ok', 'updateId', v_latest);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.edit_latest_review_update(uuid, uuid, integer, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_latest_review_update(uuid, uuid, integer, text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_review_thread(p_review_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_review record;
  v_urls text[];
  v_safe text[];
  v_regex text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT id, user_id INTO v_review FROM public.reviews WHERE id = p_review_id;
  IF v_review.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_review.user_id <> v_uid
     AND NOT COALESCE(public.has_role(v_uid, 'admin'::public.app_role), false) THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  PERFORM pg_advisory_xact_lock(public.review_timeline_lock_key(p_review_id));

  SELECT id, user_id, media, image_url INTO v_review
  FROM public.reviews WHERE id = p_review_id FOR UPDATE;
  IF v_review.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_regex := '^https://[^/]+\.supabase\.co/storage/v1/object/public/post_media/'
             || v_review.user_id::text || '/';

  SELECT array_agg(DISTINCT url) INTO v_urls FROM (
    SELECT m->>'url' AS url
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_review.media) = 'array' THEN v_review.media ELSE '[]'::jsonb END) m
    UNION ALL SELECT v_review.image_url
    UNION ALL
    SELECT m->>'url'
      FROM public.review_updates u,
           jsonb_array_elements(CASE WHEN jsonb_typeof(u.media) = 'array' THEN u.media ELSE '[]'::jsonb END) m
     WHERE u.review_id = p_review_id
  ) s
  WHERE url IS NOT NULL AND url ~ v_regex;

  UPDATE public.user_entity_journeys SET source_review_id = NULL
   WHERE source_review_id = p_review_id;

  DELETE FROM public.reviews WHERE id = p_review_id;

  IF v_urls IS NOT NULL THEN
    SELECT array_agg(url) INTO v_safe FROM unnest(v_urls) url
     WHERE NOT EXISTS (SELECT 1 FROM public.reviews r
                        WHERE r.image_url = url OR r.media::text LIKE '%' || url || '%')
       AND NOT EXISTS (SELECT 1 FROM public.review_updates u WHERE u.media::text LIKE '%' || url || '%')
       AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.media::text LIKE '%' || url || '%')
       AND NOT EXISTS (SELECT 1 FROM public.entities e WHERE e.image_url = url);
  END IF;

  RETURN jsonb_build_object('status', 'deleted',
    'mediaToClean', to_jsonb(COALESCE(v_safe, ARRAY[]::text[])));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_review_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_review_thread(uuid) TO authenticated;