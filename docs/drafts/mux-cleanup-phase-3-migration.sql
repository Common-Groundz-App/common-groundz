-- =====================================================================
-- Mux cleanup Phase 3 — REVIEW DRAFT ONLY. NOT APPLIED.
-- Dry-run infrastructure. Contains NO Mux DELETE path and NO live mode.
-- Apply only after owner approval, via the migration tool, unchanged.
-- =====================================================================
--
-- Identity: saved media items carry provider='mux' + mux_upload_id.
-- Asset identity is ALWAYS resolved server-side through
--   media item.mux_upload_id -> public.mux_uploads.upload_id -> asset_id
-- An embedded mux_asset_id is used only as a cross-check; it never
-- overrides the persisted upload record.
--
-- Locks: pg_advisory_xact_lock(hashtextextended('mux_asset_lock:'||asset,0))
-- 64-bit key; collisions are extremely unlikely but possible. A collision
-- only serializes two unrelated assets (safe, slower); it never lets a
-- save and a claim on the same asset run concurrently.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
CREATE TABLE public.mux_deletion_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mux_asset_id text NOT NULL UNIQUE,
  upload_record_id uuid,
  source_kind text NOT NULL CHECK (source_kind IN ('post','review','review_update','unlinked_sweep')),
  enqueue_reason text NOT NULL CHECK (enqueue_reason IN (
    'post_soft_deleted','post_hard_deleted','post_media_removed',
    'review_hard_deleted','review_media_removed',
    'review_update_hard_deleted','review_update_media_removed',
    'reconciliation_sweep')),
  status text NOT NULL DEFAULT 'pending_grace' CHECK (status IN (
    'pending_grace','eligible','rescued_referenced','protected_ambiguous',
    'deleting','deleted','reconciled_already_deleted','retryable_error','failed_manual')),
  protection_reason text,
  discovered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  eligible_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '24 hours',
  lifecycle_attempt integer NOT NULL DEFAULT 1,
  -- non-blocking worker lease (dry-run and future live)
  worker_lease_id uuid,
  worker_lease_expires_at timestamptz,
  -- destructive barrier (never written in Phase 3)
  is_destructively_claimed boolean NOT NULL DEFAULT false,
  destructive_claim_token uuid,
  destructive_claimed_at timestamptz,
  claim_generation integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  last_check_result text,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT mux_candidates_claim_consistent CHECK (
    (is_destructively_claimed AND destructive_claim_token IS NOT NULL AND destructive_claimed_at IS NOT NULL
       AND status IN ('deleting','deleted','reconciled_already_deleted','retryable_error','failed_manual'))
    OR (NOT is_destructively_claimed AND destructive_claim_token IS NULL AND destructive_claimed_at IS NULL
       AND status NOT IN ('deleting','deleted','reconciled_already_deleted','retryable_error','failed_manual')))
);
CREATE INDEX mux_candidates_due_idx ON public.mux_deletion_candidates (status, eligible_at);

CREATE TABLE public.mux_cleanup_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dry_run','live')),
  candidate_id uuid REFERENCES public.mux_deletion_candidates(id) ON DELETE RESTRICT,
  mux_asset_id text NOT NULL,
  action text NOT NULL CHECK (action IN (
    'promoted_eligible','rescued_referenced','kept_protected','simulated_would_delete',
    'skipped_referenced','skipped_ambiguous','skipped_destructive','deleted_live','reconciled_404','errored')),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Unresolved identities and barrier conflicts. Never blocks user deletes.
CREATE TABLE public.mux_cleanup_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('unresolved_identity','asset_mismatch','enqueue_on_destructive','sweep_age_only_protected')),
  source_kind text NOT NULL,
  source_id uuid,
  mux_upload_id text,
  mux_asset_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

GRANT ALL ON public.mux_deletion_candidates TO service_role;
GRANT ALL ON public.mux_cleanup_audit_logs TO service_role;
GRANT ALL ON public.mux_cleanup_observations TO service_role;
REVOKE ALL ON public.mux_deletion_candidates, public.mux_cleanup_audit_logs, public.mux_cleanup_observations
  FROM PUBLIC, anon, authenticated;
ALTER TABLE public.mux_deletion_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mux_cleanup_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mux_cleanup_observations ENABLE ROW LEVEL SECURITY;
-- No policies: clients have no access. service_role bypasses RLS.

-- ---------------------------------------------------------------------
-- 2. Tombstone guard: protects the barrier, not the whole row
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_candidates_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'mux_deletion_candidates rows cannot be deleted' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := clock_timestamp();
  IF OLD.is_destructively_claimed THEN
    IF NOT NEW.is_destructively_claimed
       OR NEW.destructive_claim_token IS DISTINCT FROM OLD.destructive_claim_token
       OR NEW.destructive_claimed_at IS DISTINCT FROM OLD.destructive_claimed_at
       OR NEW.claim_generation <> OLD.claim_generation
       OR NEW.mux_asset_id <> OLD.mux_asset_id THEN
      RAISE EXCEPTION 'destructive barrier is immutable' USING ERRCODE = '42501';
    END IF;
    -- allowed post-claim transitions only
    IF NOT (
         (OLD.status = NEW.status)
      OR (OLD.status = 'deleting' AND NEW.status IN ('deleted','reconciled_already_deleted','retryable_error','failed_manual'))
      OR (OLD.status = 'retryable_error' AND NEW.status IN ('deleting','failed_manual'))
    ) THEN
      RAISE EXCEPTION 'illegal transition % -> % on claimed asset', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
    IF OLD.status IN ('deleted','reconciled_already_deleted') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'terminal state is final' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.mux_asset_id <> OLD.mux_asset_id THEN
      RAISE EXCEPTION 'asset identity is immutable' USING ERRCODE = '42501';
    END IF;
    -- Phase 3: no path may enter a destructive claim at all.
    IF NEW.is_destructively_claimed THEN
      RAISE EXCEPTION 'live destructive claims are not available in this phase' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER mux_candidates_guard
  BEFORE UPDATE OR DELETE ON public.mux_deletion_candidates
  FOR EACH ROW EXECUTE FUNCTION public.mux_candidates_guard();

CREATE OR REPLACE FUNCTION public.mux_candidates_insert_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.is_destructively_claimed THEN
    RAISE EXCEPTION 'live destructive claims are not available in this phase' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mux_candidates_insert_guard
  BEFORE INSERT ON public.mux_deletion_candidates
  FOR EACH ROW EXECUTE FUNCTION public.mux_candidates_insert_guard();

CREATE OR REPLACE FUNCTION public.mux_cleanup_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END $$;
CREATE TRIGGER mux_audit_append_only BEFORE UPDATE OR DELETE ON public.mux_cleanup_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.mux_cleanup_append_only();
CREATE TRIGGER mux_observations_append_only BEFORE UPDATE OR DELETE ON public.mux_cleanup_observations
  FOR EACH ROW EXECUTE FUNCTION public.mux_cleanup_append_only();

-- ---------------------------------------------------------------------
-- 3. Lock helper (sorted, de-duplicated within one call)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_lock_assets(p_asset_ids text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v text;
BEGIN
  FOR v IN SELECT DISTINCT a FROM unnest(p_asset_ids) a WHERE a IS NOT NULL AND a <> '' ORDER BY a LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mux_asset_lock:' || v, 0));
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. Canonical resolver: media jsonb -> (upload_id, asset_id, resolved)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_resolve_media_assets(p_media jsonb)
RETURNS TABLE (mux_upload_id text, mux_asset_id text, upload_record_id uuid, embedded_asset_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT e->>'mux_upload_id', u.asset_id, u.id, NULLIF(e->>'mux_asset_id','')
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_media) = 'array' THEN p_media ELSE '[]'::jsonb END) e
    LEFT JOIN public.mux_uploads u ON u.upload_id = e->>'mux_upload_id'
   WHERE e->>'provider' = 'mux'
      OR COALESCE(e->>'mux_upload_id','') <> ''
      OR COALESCE(e->>'mux_asset_id','') <> ''
$$;

-- ---------------------------------------------------------------------
-- 5. Cleanup mode (fails closed). Phase 3 always returns dry_run.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_mode()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT 'dry_run'::text  -- live mode intentionally unavailable until separately approved
$$;

-- ---------------------------------------------------------------------
-- 6. Idempotent enqueue (caller must already hold the asset lock)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_enqueue_asset_locked(
  p_asset_id text, p_upload_record_id uuid, p_source_kind text, p_reason text, p_source_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.mux_deletion_candidates%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE mux_asset_id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.mux_deletion_candidates (mux_asset_id, upload_record_id, source_kind, enqueue_reason)
    VALUES (p_asset_id, p_upload_record_id, p_source_kind, p_reason);
    RETURN;
  END IF;
  IF c.is_destructively_claimed THEN
    INSERT INTO public.mux_cleanup_observations (kind, source_kind, source_id, mux_asset_id, details)
    VALUES ('enqueue_on_destructive', p_source_kind, p_source_id, p_asset_id, jsonb_build_object('status', c.status, 'reason', p_reason));
    RETURN;  -- barrier preserved; content change itself is not blocked
  END IF;
  IF c.status = 'rescued_referenced' THEN
    -- genuinely new committed removal after rescue: fresh lifecycle
    UPDATE public.mux_deletion_candidates
       SET status = 'pending_grace', source_kind = p_source_kind, enqueue_reason = p_reason,
           upload_record_id = COALESCE(p_upload_record_id, upload_record_id),
           discovered_at = clock_timestamp(), eligible_at = clock_timestamp() + interval '24 hours',
           lifecycle_attempt = lifecycle_attempt + 1,
           worker_lease_id = NULL, worker_lease_expires_at = NULL, last_check_result = NULL
     WHERE id = c.id;
  END IF;
  -- pending_grace / eligible: keep existing grace clock (idempotent)
  -- protected_ambiguous: protection retained
END $$;

-- Content-side enqueue for one media array. Never raises for identity problems.
CREATE OR REPLACE FUNCTION public.mux_enqueue_removed_media(
  p_old jsonb, p_new jsonb, p_source_kind text, p_reason text, p_source_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record; v_assets text[];
BEGIN
  -- removed = old upload ids not present in new
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.mux_removed (mux_upload_id text, mux_asset_id text, upload_record_id uuid, embedded_asset_id text) ON COMMIT DROP;
  TRUNCATE pg_temp.mux_removed;
  INSERT INTO pg_temp.mux_removed
  SELECT o.* FROM public.mux_resolve_media_assets(p_old) o
   WHERE NOT EXISTS (
     SELECT 1 FROM public.mux_resolve_media_assets(p_new) n
      WHERE n.mux_upload_id IS NOT DISTINCT FROM o.mux_upload_id
        AND COALESCE(n.mux_asset_id, n.embedded_asset_id) IS NOT DISTINCT FROM COALESCE(o.mux_asset_id, o.embedded_asset_id));

  FOR r IN SELECT * FROM pg_temp.mux_removed WHERE mux_asset_id IS NULL LOOP
    INSERT INTO public.mux_cleanup_observations (kind, source_kind, source_id, mux_upload_id, mux_asset_id, details)
    VALUES ('unresolved_identity', p_source_kind, p_source_id, r.mux_upload_id, r.embedded_asset_id,
            jsonb_build_object('reason', p_reason, 'upload_row_found', r.upload_record_id IS NOT NULL));
  END LOOP;
  FOR r IN SELECT * FROM pg_temp.mux_removed WHERE mux_asset_id IS NOT NULL AND embedded_asset_id IS NOT NULL AND embedded_asset_id <> mux_asset_id LOOP
    INSERT INTO public.mux_cleanup_observations (kind, source_kind, source_id, mux_upload_id, mux_asset_id, details)
    VALUES ('asset_mismatch', p_source_kind, p_source_id, r.mux_upload_id, r.mux_asset_id, jsonb_build_object('embedded', r.embedded_asset_id));
  END LOOP;

  SELECT array_agg(DISTINCT mux_asset_id) INTO v_assets FROM pg_temp.mux_removed WHERE mux_asset_id IS NOT NULL;
  IF v_assets IS NULL THEN RETURN; END IF;
  PERFORM public.mux_lock_assets(v_assets);
  FOR r IN SELECT DISTINCT ON (mux_asset_id) * FROM pg_temp.mux_removed WHERE mux_asset_id IS NOT NULL ORDER BY mux_asset_id LOOP
    PERFORM public.mux_enqueue_asset_locked(r.mux_asset_id, r.upload_record_id, p_source_kind, p_reason, p_source_id);
  END LOOP;
END $$;

-- Attachment-side rescue/barrier for one media array (new references).
CREATE OR REPLACE FUNCTION public.mux_rescue_attached_media(p_media jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_assets text[]; v text; c public.mux_deletion_candidates%ROWTYPE;
BEGIN
  SELECT array_agg(DISTINCT mux_asset_id) INTO v_assets
    FROM public.mux_resolve_media_assets(p_media) WHERE mux_asset_id IS NOT NULL;
  IF v_assets IS NULL THEN RETURN; END IF;  -- not-yet-ready uploads have no asset; nothing to rescue
  PERFORM public.mux_lock_assets(v_assets);
  FOREACH v IN ARRAY v_assets LOOP
    SELECT * INTO c FROM public.mux_deletion_candidates WHERE mux_asset_id = v FOR UPDATE;
    CONTINUE WHEN NOT FOUND;
    IF c.is_destructively_claimed THEN
      RAISE EXCEPTION 'video_unavailable' USING ERRCODE = 'P0001', DETAIL = 'mux asset has been removed';
    END IF;
    IF c.status IN ('pending_grace','eligible') THEN
      UPDATE public.mux_deletion_candidates
         SET status = 'rescued_referenced', worker_lease_id = NULL, worker_lease_expires_at = NULL
       WHERE id = c.id;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 7. Content triggers (AFTER; run inside the authoritative transaction)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_posts_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT COALESCE(OLD.is_deleted, false) THEN
      PERFORM public.mux_enqueue_removed_media(OLD.media, '[]'::jsonb, 'post', 'post_hard_deleted', OLD.id);
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.mux_rescue_attached_media(NEW.media); RETURN NEW;
  END IF;
  IF NOT COALESCE(OLD.is_deleted,false) AND COALESCE(NEW.is_deleted,false) THEN
    PERFORM public.mux_enqueue_removed_media(OLD.media, '[]'::jsonb, 'post', 'post_soft_deleted', OLD.id);
  ELSIF NOT COALESCE(NEW.is_deleted,false) AND NEW.media IS DISTINCT FROM OLD.media THEN
    PERFORM public.mux_enqueue_removed_media(OLD.media, NEW.media, 'post', 'post_media_removed', OLD.id);
    PERFORM public.mux_rescue_attached_media(NEW.media);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mux_cleanup_reviews_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_kind text := CASE WHEN TG_TABLE_NAME = 'reviews' THEN 'review' ELSE 'review_update' END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.mux_enqueue_removed_media(OLD.media, '[]'::jsonb, v_kind, v_kind || '_hard_deleted', OLD.id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.mux_rescue_attached_media(NEW.media);
  ELSIF NEW.media IS DISTINCT FROM OLD.media THEN
    PERFORM public.mux_enqueue_removed_media(OLD.media, NEW.media, v_kind, v_kind || '_media_removed', OLD.id);
    PERFORM public.mux_rescue_attached_media(NEW.media);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER mux_cleanup_posts AFTER INSERT OR UPDATE OF is_deleted, media OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.mux_cleanup_posts_trg();
CREATE TRIGGER mux_cleanup_reviews AFTER INSERT OR UPDATE OF media OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.mux_cleanup_reviews_trg();
-- Fires for direct deletes AND for ON DELETE CASCADE from reviews.
CREATE TRIGGER mux_cleanup_review_updates AFTER INSERT OR UPDATE OF media OR DELETE ON public.review_updates
  FOR EACH ROW EXECUTE FUNCTION public.mux_cleanup_reviews_trg();

-- ---------------------------------------------------------------------
-- 8. Authoritative reference state for one asset
--    'referenced' | 'ambiguous' | 'unreferenced'
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_asset_reference_state(p_asset_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_uploads text[]; v_refs int; v_amb text;
BEGIN
  SELECT array_agg(upload_id) INTO v_uploads FROM public.mux_uploads WHERE asset_id = p_asset_id;

  SELECT count(*) INTO v_refs FROM (
    SELECT 1 FROM public.posts p, jsonb_array_elements(CASE WHEN jsonb_typeof(p.media)='array' THEN p.media ELSE '[]' END) e
     WHERE NOT COALESCE(p.is_deleted,false)
       AND (e->>'mux_asset_id' = p_asset_id OR e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}')))
    UNION ALL
    SELECT 1 FROM public.reviews r, jsonb_array_elements(CASE WHEN jsonb_typeof(r.media)='array' THEN r.media ELSE '[]' END) e
     WHERE e->>'mux_asset_id' = p_asset_id OR e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}'))
    UNION ALL
    SELECT 1 FROM public.review_updates u, jsonb_array_elements(CASE WHEN jsonb_typeof(u.media)='array' THEN u.media ELSE '[]' END) e
     WHERE e->>'mux_asset_id' = p_asset_id OR e->>'mux_upload_id' = ANY(COALESCE(v_uploads,'{}'))
  ) x;
  IF v_refs > 0 THEN RETURN jsonb_build_object('state','referenced','references',v_refs); END IF;

  -- active workflow: another upload record for this asset still in flight
  IF EXISTS (SELECT 1 FROM public.mux_uploads WHERE asset_id = p_asset_id AND status::text IN ('waiting','asset_created')) THEN
    v_amb := 'upload_in_flight';
  -- inconsistent mapping: live mapping pointing at content that still exists
  ELSIF EXISTS (
    SELECT 1 FROM public.mux_upload_mappings m
     WHERE m.mux_upload_id = ANY(COALESCE(v_uploads,'{}'))
       AND m.status IN ('pending','patched')
       AND (   (m.content_type='post' AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id=m.content_id AND NOT COALESCE(p.is_deleted,false)))
            OR (m.content_type='review' AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.id=m.content_id))
            OR (m.content_type='review_update' AND EXISTS (SELECT 1 FROM public.review_updates u WHERE u.id=m.content_id)))) THEN
    v_amb := 'inconsistent_live_mapping';
  END IF;
  -- removed/orphaned mappings and mappings to deleted content do NOT protect forever.
  IF v_amb IS NOT NULL THEN RETURN jsonb_build_object('state','ambiguous','reason',v_amb); END IF;
  RETURN jsonb_build_object('state','unreferenced','upload_records',COALESCE(array_length(v_uploads,1),0));
END $$;

-- ---------------------------------------------------------------------
-- 9. Dry-run worker step (pure SQL; never touches Mux, never claims)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_dry_run(p_limit int DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_run uuid := gen_random_uuid(); v_lease uuid := gen_random_uuid();
        c record; v_ref jsonb; n_promoted int := 0; n_would int := 0; n_rescued int := 0; n_amb int := 0;
BEGIN
  IF public.mux_cleanup_mode() <> 'dry_run' THEN RAISE EXCEPTION 'only dry_run is available'; END IF;
  p_limit := LEAST(GREATEST(COALESCE(p_limit,25),1),25);

  -- non-blocking lease on due rows
  FOR c IN
    WITH due AS (
      SELECT id FROM public.mux_deletion_candidates
       WHERE NOT is_destructively_claimed
         AND status IN ('pending_grace','eligible') AND eligible_at <= clock_timestamp()
         AND (worker_lease_expires_at IS NULL OR worker_lease_expires_at < clock_timestamp())
       ORDER BY eligible_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
    UPDATE public.mux_deletion_candidates d
       SET worker_lease_id = v_lease, worker_lease_expires_at = clock_timestamp() + interval '5 minutes'
      FROM due WHERE d.id = due.id RETURNING d.id, d.mux_asset_id
  LOOP
    PERFORM public.mux_lock_assets(ARRAY[c.mux_asset_id]);
    v_ref := public.mux_asset_reference_state(c.mux_asset_id);
    IF v_ref->>'state' = 'referenced' THEN
      UPDATE public.mux_deletion_candidates SET status='rescued_referenced', last_checked_at=clock_timestamp(),
             last_check_result='referenced', worker_lease_id=NULL, worker_lease_expires_at=NULL
       WHERE id=c.id AND worker_lease_id=v_lease;
      INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
      VALUES (v_run,'dry_run',c.id,c.mux_asset_id,'rescued_referenced',v_ref);
      n_rescued := n_rescued + 1;
    ELSIF v_ref->>'state' = 'ambiguous' THEN
      UPDATE public.mux_deletion_candidates SET last_checked_at=clock_timestamp(), last_check_result='ambiguous',
             worker_lease_id=NULL, worker_lease_expires_at=NULL
       WHERE id=c.id AND worker_lease_id=v_lease;
      INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
      VALUES (v_run,'dry_run',c.id,c.mux_asset_id,'skipped_ambiguous',v_ref);
      n_amb := n_amb + 1;
    ELSE
      UPDATE public.mux_deletion_candidates
         SET status='eligible', last_checked_at=clock_timestamp(), last_check_result='would_delete',
             worker_lease_id=NULL, worker_lease_expires_at=NULL
       WHERE id=c.id AND worker_lease_id=v_lease;
      INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
      VALUES (v_run,'dry_run',c.id,c.mux_asset_id,'simulated_would_delete',v_ref);
      n_would := n_would + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('run_id',v_run,'mode','dry_run','would_delete',n_would,'rescued',n_rescued,'ambiguous',n_amb);
END $$;

-- ---------------------------------------------------------------------
-- 10. Sweeper: age-only unlinked uploads stay PROTECTED (no abandonment
--     policy approved). Records them; never makes them eligible.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_sweep(p_limit int DEFAULT 200)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record; v_ref jsonb; n int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (u.asset_id) u.asset_id, u.id
      FROM public.mux_uploads u
     WHERE u.asset_id IS NOT NULL AND u.created_at < clock_timestamp() - interval '24 hours'
       AND NOT EXISTS (SELECT 1 FROM public.mux_deletion_candidates c WHERE c.mux_asset_id = u.asset_id)
     ORDER BY u.asset_id, u.created_at LIMIT LEAST(GREATEST(COALESCE(p_limit,200),1),500)
  LOOP
    PERFORM public.mux_lock_assets(ARRAY[r.asset_id]);
    v_ref := public.mux_asset_reference_state(r.asset_id);
    CONTINUE WHEN v_ref->>'state' = 'referenced';
    INSERT INTO public.mux_deletion_candidates
      (mux_asset_id, upload_record_id, source_kind, enqueue_reason, status, protection_reason)
    VALUES (r.asset_id, r.id, 'unlinked_sweep', 'reconciliation_sweep', 'protected_ambiguous',
            CASE WHEN v_ref->>'state' = 'ambiguous' THEN v_ref->>'reason' ELSE 'age_only_no_abandonment_policy' END)
    ON CONFLICT (mux_asset_id) DO NOTHING;
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('protected_recorded', n);
END $$;

-- ---------------------------------------------------------------------
-- 11. Privileges: internal only
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  public.mux_candidates_guard(), public.mux_candidates_insert_guard(), public.mux_cleanup_append_only(),
  public.mux_lock_assets(text[]), public.mux_resolve_media_assets(jsonb), public.mux_cleanup_mode(),
  public.mux_enqueue_asset_locked(text,uuid,text,text,uuid),
  public.mux_enqueue_removed_media(jsonb,jsonb,text,text,uuid),
  public.mux_rescue_attached_media(jsonb),
  public.mux_cleanup_posts_trg(), public.mux_cleanup_reviews_trg(),
  public.mux_asset_reference_state(text), public.mux_cleanup_dry_run(int), public.mux_cleanup_sweep(int)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mux_cleanup_dry_run(int), public.mux_cleanup_sweep(int),
  public.mux_asset_reference_state(text) TO service_role;

COMMIT;

-- Cron (NOT part of this package; separate approval). Sketch only:
-- SELECT cron.schedule('mux-cleanup-dry-run','17 3 * * *',
--   $$SELECT public.mux_cleanup_sweep(); SELECT public.mux_cleanup_dry_run(25);$$);
-- Dry-run is pure SQL, so no pg_net call and no credential is needed.
-- A future live worker would use pg_net with a Vault secret read at run time.
