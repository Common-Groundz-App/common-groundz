BEGIN;

CREATE TABLE public.mux_cleanup_live_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_run_id uuid NOT NULL,
  trigger_source text NOT NULL CHECK (trigger_source IN ('cron','admin')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','paused','failed')),
  selected int,
  results jsonb,
  error_category text CHECK (error_category IS NULL OR error_category IN ('select_rpc_error','worker_exception')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz
);
GRANT ALL ON public.mux_cleanup_live_runs TO service_role;
REVOKE ALL ON public.mux_cleanup_live_runs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.mux_cleanup_live_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX mux_cleanup_live_runs_started_idx ON public.mux_cleanup_live_runs (started_at DESC, id DESC);
CREATE INDEX mux_cleanup_live_runs_cron_idx ON public.mux_cleanup_live_runs (started_at DESC, id DESC) WHERE trigger_source = 'cron';

CREATE FUNCTION public.mux_live_run_start(p_worker_run_id uuid, p_trigger_source text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_trigger_source NOT IN ('cron','admin') THEN RAISE EXCEPTION 'invalid trigger source'; END IF;
  INSERT INTO public.mux_cleanup_live_runs (worker_run_id, trigger_source)
    VALUES (p_worker_run_id, p_trigger_source) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION public.mux_live_run_finish(p_id uuid, p_status text, p_selected int, p_results jsonb, p_error_category text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_status NOT IN ('succeeded','paused','failed') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF p_error_category IS NOT NULL AND p_error_category NOT IN ('select_rpc_error','worker_exception') THEN RAISE EXCEPTION 'invalid error category'; END IF;
  UPDATE public.mux_cleanup_live_runs
     SET status = p_status, selected = p_selected, results = p_results,
         error_category = p_error_category, finished_at = clock_timestamp()
   WHERE id = p_id;
END $$;

CREATE FUNCTION public.admin_mux_live_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_enabled boolean; v_updated timestamptz;
  v_sched text; v_active boolean; v_minute int; v_next timestamptz;
  v_last_cron jsonb; v_last_any jsonb; v_overdue boolean;
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  SELECT live_enabled, updated_at INTO v_enabled, v_updated
    FROM public.mux_cleanup_live_control WHERE id = 1;
  BEGIN
    SELECT schedule, active INTO v_sched, v_active
      FROM cron.job WHERE jobname = 'mux-cleanup-live-hourly' LIMIT 1;
  EXCEPTION WHEN others THEN
    v_sched := NULL; v_active := NULL;
  END;
  IF v_active IS TRUE AND v_sched ~ '^[0-9]{1,2} \* \* \* \*$' THEN
    v_minute := split_part(v_sched, ' ', 1)::int;
    v_next := date_trunc('hour', clock_timestamp()) + make_interval(mins => v_minute);
    IF v_next <= clock_timestamp() THEN v_next := v_next + interval '1 hour'; END IF;
  END IF;
  -- Automation health is judged ONLY by schedule-started (cron) runs. A manual
  -- admin "Run now" must never mask a stopped hourly schedule.
  SELECT to_jsonb(r) INTO v_last_cron FROM (
    SELECT id, worker_run_id, trigger_source, status, selected, error_category,
           started_at, finished_at,
           (status = 'running' AND started_at < clock_timestamp() - interval '10 minutes') AS stale
      FROM public.mux_cleanup_live_runs WHERE trigger_source = 'cron'
     ORDER BY started_at DESC, id DESC LIMIT 1) r;
  SELECT to_jsonb(r) INTO v_last_any FROM (
    SELECT id, worker_run_id, trigger_source, status, selected, error_category,
           started_at, finished_at,
           (status = 'running' AND started_at < clock_timestamp() - interval '10 minutes') AS stale
      FROM public.mux_cleanup_live_runs
     ORDER BY started_at DESC, id DESC LIMIT 1) r;
  v_overdue := (v_active IS TRUE)
    AND (v_last_cron IS NULL OR (v_last_cron->>'started_at')::timestamptz < clock_timestamp() - interval '90 minutes');
  RETURN jsonb_build_object(
    'live_enabled', COALESCE(v_enabled, false),
    'live_updated_at', v_updated,
    'schedule', CASE WHEN v_sched IS NULL THEN 'unavailable' ELSE v_sched END,
    'schedule_active', COALESCE(v_active, false),
    'next_run_at', v_next,
    'last_cron_run', v_last_cron,
    'last_run', v_last_any,
    'overdue', v_overdue);
END $$;

CREATE FUNCTION public.admin_list_mux_live_runs(p_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.started_at DESC, r.id DESC) FROM (
    SELECT id, worker_run_id, trigger_source, status, selected, results, error_category,
           started_at, finished_at,
           (status = 'running' AND started_at < clock_timestamp() - interval '10 minutes') AS stale
      FROM public.mux_cleanup_live_runs ORDER BY started_at DESC, id DESC LIMIT p_limit) r), '[]');
END $$;

REVOKE ALL ON FUNCTION public.mux_live_run_start(uuid, text),
  public.mux_live_run_finish(uuid, text, int, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mux_live_run_start(uuid, text),
  public.mux_live_run_finish(uuid, text, int, jsonb, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_mux_live_status(), public.admin_list_mux_live_runs(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mux_live_status(), public.admin_list_mux_live_runs(int) TO authenticated;

COMMIT;