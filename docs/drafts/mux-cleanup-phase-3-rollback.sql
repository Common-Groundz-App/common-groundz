-- Mux cleanup Phase 3 rollback — REVIEW DRAFT. Safe only while no
-- destructive claim exists (always true in Phase 3: claims are blocked).
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE is_destructively_claimed) THEN
    RAISE EXCEPTION 'destructive claims exist; rollback refused';
  END IF;
END $$;
SELECT cron.unschedule('mux-cleanup-dry-run') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='mux-cleanup-dry-run');
DROP TRIGGER IF EXISTS mux_cleanup_posts ON public.posts;
DROP TRIGGER IF EXISTS mux_cleanup_reviews ON public.reviews;
DROP TRIGGER IF EXISTS mux_cleanup_review_updates ON public.review_updates;
DROP FUNCTION IF EXISTS public.mux_cleanup_sweep(int), public.mux_cleanup_dry_run(int),
  public.mux_asset_reference_state(text), public.mux_cleanup_posts_trg(), public.mux_cleanup_reviews_trg(),
  public.mux_rescue_attached_media(jsonb), public.mux_enqueue_removed_media(jsonb,jsonb,text,text,uuid),
  public.mux_enqueue_asset_locked(text,uuid,text,text,uuid), public.mux_cleanup_mode(),
  public.mux_resolve_media_assets(jsonb), public.mux_lock_assets(text[]);
DROP TABLE IF EXISTS public.mux_cleanup_audit_logs, public.mux_cleanup_observations, public.mux_deletion_candidates;
DROP FUNCTION IF EXISTS public.mux_candidates_guard(), public.mux_candidates_insert_guard(), public.mux_cleanup_append_only();
COMMIT;
-- Content tables, uploads, mappings and Mux assets are untouched by rollback.
