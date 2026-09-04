DROP TABLE IF EXISTS public._stage1_closeout_results;
CREATE TABLE public._stage1_closeout_results (
  id bigserial PRIMARY KEY,
  check_name text NOT NULL,
  status text NOT NULL,
  detail text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._stage1_closeout_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "_stage1_closeout_results no application access"
  ON public._stage1_closeout_results
  FOR ALL
  TO authenticated, anon, service_role
  USING (false)
  WITH CHECK (false);

DO $parity$
DECLARE
  v_fixture jsonb := '{"declared":24,"sha256":"ba7594aa05f6ccd53c19a8b9078b4dcad42716f8bc56c937b14e5ca140ad935c","cases":[{"i":0,"e":null,"c":"movie","l":null,"r":4.5,"x":{"intent":null,"source":"rating_inferred","isRecommended":true}},{"i":1,"e":null,"c":"movie","l":null,"r":3.5,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":2,"e":null,"c":"product","l":null,"r":4,"x":{"intent":null,"source":"rating_inferred","isRecommended":true}},{"i":3,"e":null,"c":"product","l":null,"r":null,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":4,"e":{"version":1,"type":"movie","answers":{"would_recommend":"yes"}},"c":"movie","l":null,"r":1,"x":{"intent":"yes","source":"review_explicit","isRecommended":true}},{"i":5,"e":{"version":1,"type":"movie","answers":{"would_recommend":"no"}},"c":"movie","l":null,"r":5,"x":{"intent":"no","source":"review_explicit","isRecommended":false}},{"i":6,"e":{"version":1,"type":"place","answers":{"would_recommend":"maybe"}},"c":"place","l":null,"r":5,"x":{"intent":"maybe","source":"review_explicit","isRecommended":false}},{"i":7,"e":{"version":2,"type":"movie","answers":{"would_recommend":"no"}},"c":"movie","l":null,"r":5,"x":{"intent":null,"source":"rating_inferred","isRecommended":true}},{"i":8,"e":{"version":"1","type":"movie","answers":{"would_recommend":"no"}},"c":"movie","l":null,"r":5,"x":{"intent":null,"source":"rating_inferred","isRecommended":true}},{"i":9,"e":{"version":1,"type":"food","answers":{"would_recommend":"no"}},"c":"movie","l":null,"r":5,"x":{"intent":null,"source":"rating_inferred","isRecommended":true}},{"i":10,"e":{"version":1,"type":"movie"},"c":"movie","l":null,"r":2,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":11,"e":{"version":1,"type":"movie","answers":["yes"]},"c":"movie","l":null,"r":2,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":12,"e":{"version":1,"type":"movie","answers":{"would_recommend":"sure"}},"c":"movie","l":null,"r":5,"x":{"intent":null,"source":"rating_inferred","isRecommended":true}},{"i":13,"e":{"version":1,"type":"movie","answers":{"would_recommend":null}},"c":"movie","l":null,"r":1,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":14,"e":[1,2,3],"c":"movie","l":null,"r":4,"x":{"intent":null,"source":"rating_inferred","isRecommended":true}},{"i":15,"e":"questionnaire","c":"movie","l":null,"r":1,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":16,"e":{"version":1,"type":"movie","answers":{"would_recommend":"no"}},"c":"movie","l":"yes","r":1,"x":{"intent":"yes","source":"timeline_explicit","isRecommended":true}},{"i":17,"e":{"version":1,"type":"movie","answers":{"would_recommend":"yes"}},"c":"movie","l":"no","r":5,"x":{"intent":"no","source":"timeline_explicit","isRecommended":false}},{"i":18,"e":null,"c":"book","l":"maybe","r":5,"x":{"intent":"maybe","source":"timeline_explicit","isRecommended":false}},{"i":19,"e":{"version":1,"type":"movie","answers":{"would_recommend":"no"}},"c":"movie","l":"auto","r":4.5,"x":{"intent":null,"source":"rating_inferred","isRecommended":true}},{"i":20,"e":{"version":1,"type":"movie","answers":{"would_recommend":"yes"}},"c":"movie","l":"auto","r":2,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":21,"e":null,"c":"movie","l":"auto","r":null,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":22,"e":{"version":1,"type":"movie","answers":{"would_recommend":"yes"}},"c":null,"l":null,"r":1,"x":{"intent":null,"source":"rating_inferred","isRecommended":false}},{"i":23,"e":{"version":1,"type":"food","answers":{"would_recommend":"yes","portion":"generous","repeat_intent":"yes"}},"c":"food","l":null,"r":1,"x":{"intent":"yes","source":"review_explicit","isRecommended":true}}]}'::jsonb;
  v_case jsonb;
  v_actual jsonb;
  v_expected jsonb;
  v_mismatches int := 0;
  v_count int := 0;
  v_declared int;
BEGIN
  v_declared := (v_fixture->>'declared')::int;

  FOR v_case IN SELECT jsonb_array_elements(v_fixture->'cases') LOOP
    v_count := v_count + 1;
    v_expected := v_case->'x';
    v_actual := public.resolve_review_recommendation(
      CASE WHEN jsonb_typeof(v_case->'e') = 'null' THEN NULL ELSE v_case->'e' END,
      v_case->>'c',
      v_case->>'l',
      CASE WHEN jsonb_typeof(v_case->'r') = 'null' THEN NULL ELSE (v_case->>'r')::numeric END
    );

    IF v_actual->'intent' IS DISTINCT FROM v_expected->'intent'
       OR v_actual->>'source' IS DISTINCT FROM v_expected->>'source'
       OR (v_actual->>'is_recommended')::boolean IS DISTINCT FROM (v_expected->>'isRecommended')::boolean
    THEN
      v_mismatches := v_mismatches + 1;
      INSERT INTO public._stage1_closeout_results(check_name, status, detail)
      VALUES ('parity case ' || (v_case->>'i'), 'FAIL',
              'expected ' || v_expected::text || ' got ' || v_actual::text);
    END IF;
  END LOOP;

  INSERT INTO public._stage1_closeout_results(check_name, status, detail)
  VALUES ('shared fixture case count', CASE WHEN v_count = v_declared THEN 'PASS' ELSE 'FAIL' END,
          'executed ' || v_count || ', declared ' || v_declared);

  INSERT INTO public._stage1_closeout_results(check_name, status, detail)
  VALUES ('SQL/TS shared truth table parity', CASE WHEN v_mismatches = 0 THEN 'PASS' ELSE 'FAIL' END,
          v_mismatches || ' mismatch(es) across ' || v_count || ' cases');
END;
$parity$;