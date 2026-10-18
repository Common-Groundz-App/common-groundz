-- Mux cleanup admin dashboard — REVIEW DRAFT (not applied).
-- Read-only views + manual sweep/dry-run wrappers. No deletion, no mode change,
-- no protection override, no cron.

-- 1. Run ledger (service-role only; read via admin RPCs)
CREATE TABLE public.mux_cleanup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('sweep','dry_run')),
  trigger_source text NOT NULL DEFAULT 'admin_manual' CHECK (trigger_source IN ('admin_manual','cron')),
  triggered_by uuid,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','rejected_locked')),
  batch_limit int,
  worker_run_id uuid,           -- = mux_cleanup_audit_logs.run_id for dry runs
  result jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz
);
GRANT ALL ON public.mux_cleanup_runs TO service_role;
REVOKE ALL ON public.mux_cleanup_runs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.mux_cleanup_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX mux_cleanup_runs_started_idx ON public.mux_cleanup_runs (started_at DESC);

-- 2. Shared run lock (manual now; future cron must call the same helper)
CREATE OR REPLACE FUNCTION public.mux_cleanup_try_run_lock()
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('mux_cleanup:run', 0));
$$;

-- 3. Admin gate
CREATE OR REPLACE FUNCTION public.mux_cleanup_require_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
END $$;

-- 4. Overview
CREATE OR REPLACE FUNCTION public.admin_mux_cleanup_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_counts jsonb; v_sched jsonb; v_jobs jsonb;
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  SELECT COALESCE(jsonb_object_agg(status, n), '{}') INTO v_counts
    FROM (SELECT status, count(*) n FROM public.mux_deletion_candidates GROUP BY status) s;
  BEGIN
    EXECUTE $q$SELECT COALESCE(jsonb_agg(jsonb_build_object('jobname',jobname,'schedule',schedule,'active',active)),'[]')
               FROM cron.job WHERE jobname ILIKE '%mux%'$q$ INTO v_jobs;
    v_sched := jsonb_build_object('state', CASE WHEN jsonb_array_length(v_jobs)=0 THEN 'not_scheduled' ELSE 'scheduled' END, 'jobs', v_jobs);
  EXCEPTION WHEN others THEN
    v_sched := jsonb_build_object('state','scheduler_unavailable');
  END;
  RETURN jsonb_build_object(
    'mode', public.mux_cleanup_mode(),
    'schedule', v_sched,
    'counts', v_counts,
    'total', (SELECT count(*) FROM public.mux_deletion_candidates),
    'destructive_claims', (SELECT count(*) FROM public.mux_deletion_candidates WHERE is_destructively_claimed),
    'active_leases', (SELECT count(*) FROM public.mux_deletion_candidates WHERE worker_lease_expires_at > clock_timestamp()),
    'due_now', (SELECT count(*) FROM public.mux_deletion_candidates WHERE status IN ('pending_grace','eligible') AND eligible_at <= clock_timestamp() AND NOT is_destructively_claimed),
    'observations', (SELECT count(*) FROM public.mux_cleanup_observations),
    'last_sweep', (SELECT to_jsonb(r) FROM public.mux_cleanup_runs r WHERE kind='sweep' ORDER BY started_at DESC LIMIT 1),
    'last_dry_run', (SELECT to_jsonb(r) FROM public.mux_cleanup_runs r WHERE kind='dry_run' ORDER BY started_at DESC LIMIT 1));
END $$;

-- 5. Candidate list (real columns only)
CREATE OR REPLACE FUNCTION public.admin_list_mux_candidates(
  p_status text DEFAULT NULL, p_source_kind text DEFAULT NULL, p_reason text DEFAULT NULL,
  p_search text DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_s text := NULLIF(btrim(left(COALESCE(p_search,''),100)),'');
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  p_limit := LEAST(GREATEST(COALESCE(p_limit,50),1),100);
  p_offset := LEAST(GREATEST(COALESCE(p_offset,0),0),100000);
  RETURN (
    WITH f AS (
      SELECT c.* FROM public.mux_deletion_candidates c
       WHERE (p_status IS NULL OR c.status = p_status)
         AND (p_source_kind IS NULL OR c.source_kind = p_source_kind)
         AND (p_reason IS NULL OR c.enqueue_reason = p_reason OR c.protection_reason = p_reason)
         AND (v_s IS NULL OR c.mux_asset_id ILIKE '%'||v_s||'%' OR c.upload_record_id::text ILIKE '%'||v_s||'%'))
    SELECT jsonb_build_object('total', (SELECT count(*) FROM f),
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.discovered_at DESC)
        FROM (SELECT id, mux_asset_id, upload_record_id, source_kind, enqueue_reason, status, protection_reason,
                     discovered_at, eligible_at, lifecycle_attempt, worker_lease_expires_at, is_destructively_claimed
                FROM f ORDER BY discovered_at DESC LIMIT p_limit OFFSET p_offset) x), '[]')));
END $$;

-- 6. Candidate detail: fields, last 50 audit rows, live references (no text)
CREATE OR REPLACE FUNCTION public.admin_mux_candidate_detail(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.mux_deletion_candidates; v_uploads text[]; v_refs jsonb;
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT array_agg(upload_id) INTO v_uploads FROM public.mux_uploads WHERE asset_id = c.mux_asset_id;
  SELECT COALESCE(jsonb_agg(r), '[]') INTO v_refs FROM (
    SELECT 'post' content_type, p.id content_id, NOT COALESCE(p.is_deleted,false) active,
           CASE WHEN e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}')) THEN 'mux_upload_id' ELSE 'resolved_asset' END match_method
      FROM public.posts p, jsonb_array_elements(CASE WHEN jsonb_typeof(p.media)='array' THEN p.media ELSE '[]' END) e
     WHERE e->>'mux_asset_id' = c.mux_asset_id OR e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}'))
    UNION ALL
    SELECT 'review', r.id, true,
           CASE WHEN e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}')) THEN 'mux_upload_id' ELSE 'resolved_asset' END
      FROM public.reviews r, jsonb_array_elements(CASE WHEN jsonb_typeof(r.media)='array' THEN r.media ELSE '[]' END) e
     WHERE e->>'mux_asset_id' = c.mux_asset_id OR e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}'))
    UNION ALL
    SELECT 'review_update', u.id, true,
           CASE WHEN e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}')) THEN 'mux_upload_id' ELSE 'resolved_asset' END
      FROM public.review_updates u, jsonb_array_elements(CASE WHEN jsonb_typeof(u.media)='array' THEN u.media ELSE '[]' END) e
     WHERE e->>'mux_asset_id' = c.mux_asset_id OR e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}'))
    LIMIT 50) r;
  RETURN jsonb_build_object(
    'candidate', to_jsonb(c) - 'destructive_claim_token' - 'worker_lease_id',
    'reference_state', public.mux_asset_reference_state(c.mux_asset_id),
    'references', v_refs,
    'audit', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM
      (SELECT run_id, mode, action, details, created_at FROM public.mux_cleanup_audit_logs
        WHERE candidate_id = c.id ORDER BY created_at DESC LIMIT 50) a), '[]'));
END $$;

-- 7. Observations
CREATE OR REPLACE FUNCTION public.admin_list_mux_observations(p_kind text DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  p_limit := LEAST(GREATEST(COALESCE(p_limit,50),1),100);
  p_offset := LEAST(GREATEST(COALESCE(p_offset,0),0),100000);
  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM public.mux_cleanup_observations WHERE p_kind IS NULL OR kind = p_kind),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC) FROM
      (SELECT id, kind, source_kind, source_id, mux_upload_id, mux_asset_id, details, created_at
         FROM public.mux_cleanup_observations WHERE p_kind IS NULL OR kind = p_kind
        ORDER BY created_at DESC LIMIT p_limit OFFSET p_offset) o), '[]'));
END $$;

-- 8. Run history
CREATE OR REPLACE FUNCTION public.admin_list_mux_cleanup_runs(p_limit int DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  p_limit := LEAST(GREATEST(COALESCE(p_limit,25),1),100);
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.started_at DESC) FROM
    (SELECT * FROM public.mux_cleanup_runs ORDER BY started_at DESC LIMIT p_limit) r), '[]');
END $$;

-- 9. Manual run wrapper (shared by sweep and dry run)
CREATE OR REPLACE FUNCTION public.mux_cleanup_execute_run(p_kind text, p_limit int, p_source text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid; v_res jsonb; v_state text; v_msg text;
BEGIN
  IF p_kind NOT IN ('sweep','dry_run') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF NOT public.mux_cleanup_try_run_lock() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'run_already_in_progress');
  END IF;
  p_limit := CASE WHEN p_kind='dry_run' THEN LEAST(GREATEST(COALESCE(p_limit,25),1),25)
                  ELSE LEAST(GREATEST(COALESCE(p_limit,200),1),200) END;
  INSERT INTO public.mux_cleanup_runs(kind, trigger_source, triggered_by, batch_limit)
    VALUES (p_kind, p_source, p_actor, p_limit) RETURNING id INTO v_id;
  BEGIN  -- subtransaction: worker's partial work rolls back on error, ledger row survives
    IF p_kind = 'dry_run' THEN v_res := public.mux_cleanup_dry_run(p_limit);
    ELSE v_res := public.mux_cleanup_sweep(p_limit); END IF;
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    UPDATE public.mux_cleanup_runs SET status='failed', finished_at=clock_timestamp(),
           error_message = v_state || ': ' || left(v_msg, 200) WHERE id = v_id;
    RETURN jsonb_build_object('ok', false, 'error', 'run_failed', 'run_id', v_id, 'sqlstate', v_state);
  END;
  UPDATE public.mux_cleanup_runs SET status='succeeded', finished_at=clock_timestamp(), result=v_res,
         worker_run_id = NULLIF(v_res->>'run_id','')::uuid WHERE id = v_id;
  RETURN jsonb_build_object('ok', true, 'run_id', v_id, 'result', v_res);
END $$;

CREATE OR REPLACE FUNCTION public.admin_run_mux_sweep()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  RETURN public.mux_cleanup_execute_run('sweep', 200, 'admin_manual', auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.admin_run_mux_dry_run(p_batch int DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  RETURN public.mux_cleanup_execute_run('dry_run', p_batch, 'admin_manual', auth.uid());
END $$;

-- 10. Privileges
REVOKE ALL ON FUNCTION public.mux_cleanup_try_run_lock(), public.mux_cleanup_require_admin(),
  public.mux_cleanup_execute_run(text,int,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mux_cleanup_try_run_lock(), public.mux_cleanup_execute_run(text,int,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.admin_mux_cleanup_overview(), public.admin_list_mux_candidates(text,text,text,text,int,int),
  public.admin_mux_candidate_detail(uuid), public.admin_list_mux_observations(text,int,int),
  public.admin_list_mux_cleanup_runs(int), public.admin_run_mux_sweep(), public.admin_run_mux_dry_run(int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mux_cleanup_overview(), public.admin_list_mux_candidates(text,text,text,text,int,int),
  public.admin_mux_candidate_detail(uuid), public.admin_list_mux_observations(text,int,int),
  public.admin_list_mux_cleanup_runs(int), public.admin_run_mux_sweep(), public.admin_run_mux_dry_run(int)
  TO authenticated;
