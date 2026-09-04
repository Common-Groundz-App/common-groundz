CREATE OR REPLACE FUNCTION public.resolve_review_recommendation(p_envelope jsonb, p_category text, p_latest_intent text, p_effective_rating numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_envelope_intent text := NULL;
  v_answers jsonb;
  v_candidate text;
BEGIN
  -- Strict envelope extraction: object, version is the JSON *number* 1 (a string
  -- "1" is malformed and rejected), type matches the review's canonical category,
  -- answers object, would_recommend exactly yes/maybe/no.
  -- Anything malformed is treated as absent, never as false.
  IF p_envelope IS NOT NULL
     AND jsonb_typeof(p_envelope) = 'object'
     AND jsonb_typeof(p_envelope->'version') = 'number'
     AND (p_envelope->>'version')::numeric = 1
     AND p_envelope->>'type' IS NOT NULL
     AND p_envelope->>'type' = p_category
     AND jsonb_typeof(p_envelope->'answers') = 'object'
  THEN
    v_answers := p_envelope->'answers';
    v_candidate := v_answers->>'would_recommend';
    IF v_candidate IN ('yes','maybe','no') THEN
      v_envelope_intent := v_candidate;
    END IF;
  END IF;

  -- 1. Latest explicit timeline intent wins.
  IF p_latest_intent IN ('yes','maybe','no') THEN
    RETURN jsonb_build_object(
      'intent', p_latest_intent,
      'source', 'timeline_explicit',
      'is_recommended', p_latest_intent = 'yes'
    );
  END IF;

  -- 1b. Latest 'auto' discards earlier explicit intent and falls back to rating.
  IF p_latest_intent = 'auto' THEN
    RETURN jsonb_build_object(
      'intent', NULL,
      'source', 'rating_inferred',
      'is_recommended', COALESCE(p_effective_rating, 0) >= 4
    );
  END IF;

  -- 2. The review's own envelope answer.
  IF v_envelope_intent IS NOT NULL THEN
    RETURN jsonb_build_object(
      'intent', v_envelope_intent,
      'source', 'review_explicit',
      'is_recommended', v_envelope_intent = 'yes'
    );
  END IF;

  -- 3. Rating fallback.
  RETURN jsonb_build_object(
    'intent', NULL,
    'source', 'rating_inferred',
    'is_recommended', COALESCE(p_effective_rating, 0) >= 4
  );
END;
$function$;

ALTER FUNCTION public.resolve_review_recommendation(jsonb, text, text, numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_review_recommendation(jsonb, text, text, numeric) FROM PUBLIC, anon, authenticated, service_role;