-- Phase 4 rollback — REVIEW DRAFT. Order matters: kill switch first.
-- Never removes candidate rows, audit rows or barriers (append-only /
-- immutable by design). Claimed rows keep blocking re-attachment.
BEGIN;
-- 1. Kill switch (idempotent): live mode off.
CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT 'dry_run'::text $$;

-- 2. Remove live entry points.
DROP FUNCTION IF EXISTS public.mux_cleanup_claim_live(uuid,uuid);
DROP FUNCTION IF EXISTS public.mux_cleanup_lease_valid(uuid,uuid);
DROP FUNCTION IF EXISTS public.mux_cleanup_finalize_live(uuid,uuid,uuid,text,int);
DROP FUNCTION IF EXISTS public.mux_live_backoff(int,int);
DROP FUNCTION IF EXISTS public.mux_live_lease_seconds();
DROP FUNCTION IF EXISTS public.mux_live_max_retries();

-- 3. Restore Phase 3 guard semantics: no new destructive claim possible.
CREATE OR REPLACE FUNCTION public.mux_candidates_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'mux_deletion_candidates rows cannot be deleted' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := clock_timestamp();
  IF NEW.mux_asset_id <> OLD.mux_asset_id THEN
    RAISE EXCEPTION 'asset identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.is_destructively_claimed THEN
    IF NOT NEW.is_destructively_claimed
       OR NEW.destructive_claim_token IS DISTINCT FROM OLD.destructive_claim_token
       OR NEW.destructive_claimed_at IS DISTINCT FROM OLD.destructive_claimed_at
       OR NEW.claim_generation <> OLD.claim_generation THEN
      RAISE EXCEPTION 'destructive barrier is immutable' USING ERRCODE = '42501';
    END IF;
    IF OLD.status IN ('deleted','reconciled_already_deleted') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'terminal state is final' USING ERRCODE = '42501';
    END IF;
    IF NOT ((OLD.status = NEW.status)
      OR (OLD.status = 'deleting' AND NEW.status IN ('deleted','reconciled_already_deleted','retryable_error','failed_manual'))
      OR (OLD.status = 'retryable_error' AND NEW.status IN ('deleting','failed_manual'))) THEN
      RAISE EXCEPTION 'illegal transition % -> % on claimed asset', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.is_destructively_claimed THEN
    RAISE EXCEPTION 'live destructive claims are not available in this phase' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- 4. Allowlist table is kept if it has rows (audit evidence); drop only if empty.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mux_cleanup_live_targets) THEN
    DROP TABLE public.mux_cleanup_live_targets;
  END IF;
END $$;
-- Audit CHECK stays widened: existing Phase 4 audit rows must remain valid.
COMMIT;
-- Post-rollback: any row left in 'deleting' or 'retryable_error' stays
-- barrier-protected; resolve via mux-inventory (asset present/absent).
