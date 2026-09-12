-- Phase 4.2B.2 family 1 hardening: project default privileges re-granted EXECUTE to anon and
-- authenticated after creation. The writers/selectors are service_role only per the frozen contract.
REVOKE EXECUTE ON FUNCTION public.select_trending_candidates_v2() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_all_trending_scores_v2(boolean) FROM anon, authenticated, PUBLIC;
-- the pure scorer stays callable by signed-in users only (never anon)
REVOKE EXECUTE ON FUNCTION public.calculate_entity_trending_score_v2(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_entity_trending_score_v2(uuid) TO authenticated, service_role;