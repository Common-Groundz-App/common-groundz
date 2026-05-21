# Phase 3B — Wire composer + webhook into Mux reconciliation

Scope: two files change. No migrations, no RPC changes, no playback/UI changes, no edit-path reconciliation.

## 1. Update `.lovable/plan.md`

Replace Phase 3A "DONE" doc with a Phase 3A summary + Phase 3B (in progress) section folding in all refinements from chatgpt/codex review:
- RPC signature confirmed: `patch_content_media_from_mux(p_mapping_id uuid) → text`
- Composer retries: transport/network errors and HTTP 5xx only; never 4xx
- Webhook log enrichment: every error/skip log includes `{ event_id, event_type, upload_id, asset_id, mapping_id }`
- DB idempotency relied upon (Phase 3A `ON CONFLICT` + per-item handling)
- Webhook calls `reconcilePendingMappings` only after `mux_uploads` UPDATE returns ≥1 row
- 0-row UPDATE → skipped reconciliation logged with full context (codex addition)
- `.limit(10)` cap on pending mapping fan-out per webhook call
- Concurrent-requeue verification scenario added

## 2. Composer wiring — `src/components/feed/EnhancedCreatePostForm.tsx`

Create path only. After successful `INSERT` into `posts`:
- Build `muxItems` by scanning `mediaToSave` (post-save shape) for items with `provider === 'mux'` and a usable upload id, mapping to `{ mux_upload_id, media_index }` (index = position in `mediaToSave`).
- If `muxItems.length === 0` → skip.
- Otherwise call `supabase.functions.invoke('mux-register-mappings', { body: { content_type: 'post', content_id: newPost.id, items: muxItems } })`.
- Retry once only when the failure is transport-class: `FunctionsFetchError` / `TypeError` / network error, or `error.context?.status >= 500`. Never retry on 4xx body errors or per-item `{results}` failures.
- On final failure: `console.error` with `{ post_id, mux_upload_ids }`, `analytics.track('mux_register_mappings_failed', …)`, and a soft non-blocking toast: `"Video processing pending — refresh in a minute to update."`. Post creation success is never blocked.
- Edit branch: add only the comment `// TODO(phase 3C): reconcile mux mappings on media edits` above the existing edit update — no behavior change.

## 3. Webhook extension — `supabase/functions/mux-webhook/index.ts`

Add `reconcilePendingMappings(admin, { uploadId, assetId, eventId, eventType })` helper:
- Resolve `uploadId` from `mux_uploads` by `asset_id` if missing.
- If still no `uploadId` → log `{ event_id, event_type, asset_id, reason: 'no_upload_id' }` and return.
- Query `mux_upload_mappings` where `mux_upload_id = uploadId` and `status = 'pending'`, `.limit(10)`.
- For each: call `admin.rpc('patch_content_media_from_mux', { p_mapping_id: m.id })`.
- Any RPC error → `console.error('reconcile_rpc_failed', { event_id, event_type, upload_id, asset_id, mapping_id, err })`. Never throw out of handler.

Call sites — **only after** the existing `mux_uploads` UPDATE call returns a non-empty `updated` array:
- `video.asset.ready` branch
- `video.asset.errored` / `video.upload.errored` branch

If 0 rows updated (race / stale state):
- `console.warn('mux_uploads_update_zero_rows', { event_id, event_type, upload_id, asset_id })` and skip reconciliation that cycle. Still return 200.

All errors inside the reconcile path are swallowed (logged) so the webhook always returns 200 on otherwise-valid events.

Webhook keeps `verify_jwt = false` (signature is the auth). Composer call remains JWT-authenticated.

## 4. Verification (curl + DB only — no UI assertions)

| # | Scenario | Expected |
|---|---|---|
| 1 | Real `.MOV` post, normal timing | mapping row created; `posts.media[0].mux_status='ready'`, `mux_playback_id` set |
| 2 | Fast composer (submit before `asset.ready`) | mapping inserted `pending` → webhook flips to `patched` |
| 3 | Slow composer (submit after `asset.ready`) | catch-up branch in `mux-register-mappings` patches synchronously |
| 4 | Image-only post | no `invoke` call; zero new mapping rows |
| 5 | Forced Mux error | `posts.media[0].mux_status='errored'`, webhook returns 200, mapping `noop_errored`/`orphaned` per rules |
| 6 | Registration endpoint offline mid-submit | post still created; toast shown; later `mux-reconcile-upload` patches |
| 7 | **New:** Submit post, immediately call `mux-reconcile-upload` as admin while webhook in-flight | row-level `SELECT … FOR UPDATE` serializes; final state `patched`, no JSONB clobber |
| 8 | **New:** `video.asset.ready` arrives but `mux_uploads` update affects 0 rows | warn logged with `{ event_id, event_type, upload_id, asset_id }`; no RPC call; 200 returned |

Feed/lightbox still shows the "Processing" poster until Phase 4 (HLS/Mux Player) — expected.

## Out of scope (unchanged)
Edit-path reconciliation (3C) · review `content_type` · HLS playback (4) · errored-state UI (5) · orphaned-upload cleanup (6).

## Rollback
Remove the composer post-insert block and the two webhook helper call-sites. Already-patched rows stay patched; new uploads fall back to pre-3A behavior.
