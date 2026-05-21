# Phase 3A — DONE ✅

Server-side Mux reconciliation infrastructure shipped (no client wiring, no webhook changes, no UI changes).

## Shipped
- **Migration:** `public.mux_upload_mappings` table + indexes + RLS (service-role only) + `update_updated_at_column` trigger.
- **RPC:** `public.patch_content_media_from_mux(p_mapping_id uuid) → text`
  - `SECURITY DEFINER`, `search_path=public`, granted to `service_role` only.
  - Row-locks the post (`SELECT … FOR UPDATE`) to prevent webhook + manual retry from clobbering JSONB.
  - Defense-in-depth ownership checks (`mux_uploads.user_id = mapping.user_id`, `posts.user_id = mapping.user_id`).
  - Integrity guards: ready-without-asset_id / ready-without-playback_id → `orphaned` rather than writing nulls.
  - Patches `mux_asset_id` on errored when available.
  - Deterministic returns: `patched | noop_not_ready | noop_already_patched | noop_orphaned | noop_errored | orphaned`.
- **Edge function:** `mux-register-mappings` (JWT-required, validates in code; per-item conflict-aware; catch-up calls RPC when Mux upload is already ready/errored; structured `{results:[…]}` response).
- **Edge function:** `mux-reconcile-upload` (JWT-required, two-tier: `service_role` JWT bypass OR `has_role(uid,'admin')`; returns `{status, mapping_id, mapping_status, mux_status_snapshot, last_error}`).
- Both functions deployed.

## Verification status
Awaiting curl/SQL verification on throwaway test data (12 scenarios in the prior plan). Not auto-run because the test setup needs a throwaway post or staged Mux upload, and we agreed not to touch real user posts (e.g. Hana Li's row).

## Scope NOT yet implemented (Phase 3B and later)
- Composer wiring (`EnhancedCreatePostForm` → `invoke('mux-register-mappings')` after post create).
- `mux-webhook` extension to call the RPC on `video.asset.ready` / `.errored`.
- `MuxErroredPoster` UI + branching renderers on `isMuxErrored`.
- Reviews wiring (CHECK constraint currently restricts `content_type` to `'post'` only).
- HLS playback (Phase 4).
- `mux-create-upload` JWT hardening (deferred cleanup).
