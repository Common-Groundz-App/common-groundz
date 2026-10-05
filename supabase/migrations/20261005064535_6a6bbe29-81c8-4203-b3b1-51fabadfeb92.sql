CREATE OR REPLACE FUNCTION public.edit_latest_review_update(p_review_id uuid, p_update_id uuid, p_rating integer, p_comment text, p_media jsonb, p_would_recommend text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- yes/maybe/no = explicit opinion; auto = explicit reset to rating; NULL = no statement.
  IF p_would_recommend IS NOT NULL AND p_would_recommend NOT IN ('yes','no','maybe','auto') THEN
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
$function$;

ALTER FUNCTION public.edit_latest_review_update(uuid, uuid, integer, text, jsonb, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.edit_latest_review_update(uuid, uuid, integer, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_latest_review_update(uuid, uuid, integer, text, jsonb, text) TO authenticated, service_role;