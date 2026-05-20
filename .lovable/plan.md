# Phase 1 cleanup — populate `mux_uploads.asset_id`

End-to-end test passed except `asset_id` is not stored on `mux_uploads`. Fix the webhook handler so the row carries `asset_id` once Mux assigns one. No schema, frontend, or `mux-create-upload` changes.

## Bugs

1. In `supabase/functions/mux-webhook/index.ts`, `uploadId` is extracted as `data?.upload_id` for every event. For `video.upload.*` events, Mux places the upload id at `data.id`. Result: `video.upload.asset_created` cannot locate the row by `upload_id`, so `asset_id` is never written and `mux_webhook_events.upload_id` is NULL for those rows.
2. The `video.asset.ready` update patch omits `asset_id`, so even when the row is matched via `asset_id` (or via `upload_id` fallback once #1 is fixed), the `asset_id` column stays NULL on first ready.

## Fix

In `mux-webhook/index.ts`:

- Compute `uploadId` per event family:
  - `video.upload.*` → `data.id ?? data.upload_id`
  - `video.asset.*`  → `data.upload_id`
- Keep `assetId` logic as-is (`video.asset.*` → `data.id`, otherwise `data.asset_id`).
- Persist the corrected `uploadId` (and `assetId`) into the `mux_webhook_events` insert.
- In the `video.asset.ready` and `video.asset.errored` / `video.upload.errored` patches, include `asset_id: assetId ?? undefined` so the row records it on first ready.
- Also handle `video.asset.created` defensively the same way as `video.upload.asset_created` (set `asset_id`, advance status to `asset_created` only if current status is `waiting` — the monotonic trigger already guards terminal states).

## Verification

1. Call `mux-create-upload`, PUT a small mp4 to `upload_url`.
2. Wait ~15s, then:
   - `SELECT status, asset_id, playback_id, duration, aspect_ratio FROM mux_uploads WHERE upload_id = '<id>'` → expect `status='ready'` and `asset_id` populated.
   - `SELECT event_type, upload_id, asset_id FROM mux_webhook_events WHERE asset_id = '<asset>'` → all 4 rows should have correct `upload_id` and `asset_id`.
3. Re-send (Mux dashboard "resend") one event → row count for that `event_id` stays 1, response `duplicate_ok`.

## Out of scope

Frontend recorder, playback UI, signed playback, thumbnails — all Phase 2.
