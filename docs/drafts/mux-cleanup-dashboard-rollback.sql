-- Mux cleanup dashboard rollback. Removes only dashboard objects; the Phase 3
-- queue, audit, observations, triggers and worker are untouched.
BEGIN;
DROP FUNCTION IF EXISTS public.admin_run_mux_dry_run(int), public.admin_run_mux_sweep(),
  public.mux_cleanup_execute_run(text,int,text,uuid), public.admin_list_mux_cleanup_runs(int),
  public.admin_list_mux_observations(text,int,int), public.admin_mux_candidate_detail(uuid),
  public.admin_list_mux_candidates(text,text,text,text,int,int), public.admin_mux_cleanup_overview(),
  public.mux_cleanup_require_admin(), public.mux_cleanup_try_run_lock();
DROP TABLE IF EXISTS public.mux_cleanup_runs;
COMMIT;
