# Phase 2A — Renderer safety for Mux "preparing" videos (no upload routing yet)

Make every video renderer safe to receive a Mux MediaItem in `preparing` state **before** any such item can be created. After 2A, the codebase still produces zero Mux items (no upload branch yet), but it is provably ready for them.

## Scope

### 1. Extend `MediaItem` (additive) — `src/types/media.ts`
Add optional fields. No existing call site needs to change.
```ts
provider?: 'supabase' | 'mux';
mux_upload_id?: string;
mux_asset_id?: string;
mux_playback_id?: string;
mux_status?: 'preparing' | 'ready' | 'errored';
mux_error?: string;
```

### 2. Add helper — `src/utils/muxMedia.ts` (new)
```ts
export const isMuxItem = (m: MediaItem) => m.provider === 'mux';
export const isMuxPreparing = (m: MediaItem) =>
  m.provider === 'mux' && m.mux_status !== 'ready';
export const isMuxErrored = (m: MediaItem) =>
  m.provider === 'mux' && m.mux_status === 'errored';
```

### 3. Audit + guard every video renderer
For each surface, if `isMuxPreparing(item)` is true:
- **Do not** mount `<video>` or hls.js.
- Render poster (`item.thumbnail_url ?? item.url`) with a small "Processing" badge (use existing badge primitives; no new design).
- If `isMuxErrored(item)`, show poster + "Couldn't process video" label. No retry button in 2A.

Surfaces to audit (search `<video` and uses of `MediaItem` where `type === 'video'`):
- `FeedVideo` (or whatever wraps the feed `<video>` element)
- `LightboxPreview` / lightbox video path
- `FeedCollage` video tiles
- Composer media preview (`MediaUploader` preview tiles)
- `EnhancedCreatePostForm` edit-mode preview
- Any entity/profile/post-detail video renderer that consumes `MediaItem`

Use `rg "type === 'video'"` and `rg "<video"` to find them all. Document every guarded site in the PR description.

### 4. Test fixture — `src/utils/__fixtures__/muxMedia.ts` (new)
Export a `mockMuxPreparingMediaItem` and `mockMuxErroredMediaItem` so any renderer or Storybook can verify the guard. Add one render test per critical surface (FeedVideo + LightboxPreview + MediaUploader preview) asserting that `<video>` is **not** in the DOM when given a preparing Mux item.

## Explicitly NOT in 2A
- No `VITE_MUX_UPLOAD_ENABLED` flag.
- No changes to `mediaService.ts`.
- No call to `mux-create-upload` from the client.
- No mapping table, webhook changes, RPC, reconciliation.
- No hls.js, Mux Player, signed playback, captions, storyboards.
- No edit/reorder logic, no backfill.
- No reviews wiring.

## Verification gates (must all pass)
1. Type-check passes; existing photo + video uploads behave identically (zero behavioural diff).
2. Fixture-based render tests: preparing Mux item → no `<video>` tag, poster + Processing badge visible. Errored Mux item → poster + error label.
3. Existing Supabase videos render unchanged in feed, lightbox, composer.
4. PR description lists every renderer touched + one-line confirmation it was guarded.

## Rollback
Revert the PR. No data exists in Mux shape yet, so nothing to clean up.

---

# Phase 2B — Route new video uploads to Mux (behind flag)

Only after 2A is merged and verified.

## Confirmed contract — `mux-create-upload`
Reads from `supabase/functions/mux-create-upload/index.ts` (deployed Phase 1):
```json
{ "upload_id": "...", "upload_url": "...", "is_test": false, "expires_at": "..." }
```
We use these snake_case names directly in `mediaService.ts` — no field-name normalization. A one-line comment above the invoke call points back to the edge function as the source of truth.

## Scope

### 1. Flag — `.env` + `src/services/mediaService.ts`
- Add `VITE_MUX_UPLOAD_ENABLED=false` to `.env` (documented, off by default).
- Helper:
  ```ts
  const isMuxEnabled = () => import.meta.env.VITE_MUX_UPLOAD_ENABLED === 'true';
  ```

### 2. Mux branch in `uploadMedia` (videos only, flag on)
1. `analytics.trackMuxUploadAttempt({ size, duration, format })`.
2. **Poster is required.** Generate poster from the file. Upload it to Supabase Storage (existing path). If generation OR upload fails → `trackMuxUploadFailure({ stage: 'poster', error })` → throw `"Couldn't prepare video preview. Try again."`. No empty `url` ever produced.
3. `supabase.functions.invoke('mux-create-upload')`. On error or missing `upload_id` / `upload_url` → `trackMuxUploadFailure({ stage: 'create_upload', error })` → best-effort `deleteMedia(posterUrl)` (fire-and-forget, errors swallowed) → throw `"Couldn't start video upload. Try again."`.
4. PUT file to `upload_url` via `XMLHttpRequest` (gives `upload.onprogress` → `onProgress(pct, 'uploading')`). On non-2xx / network error → `trackMuxUploadFailure({ stage: 'put', status, error })` → best-effort `deleteMedia(posterUrl)` → throw `"Video upload failed. Try again."`.
5. `trackMuxUploadSuccess({ upload_id, size, duration })`.
6. Return:
   ```ts
   {
     id, type: 'video', provider: 'mux',
     mux_upload_id: upload_id, mux_status: 'preparing',
     url: posterUrl, thumbnail_url: posterUrl, // posterUrl guaranteed non-empty
     width, height, duration, orientation,
     order: 0, session_id, caption: '', alt: file.name.split('.')[0],
   }
   ```

**No fallback to Supabase on failure.** Hard fail; existing composer error handling takes over.

### 3. Telemetry — `src/services/analytics.ts`
Add (non-blocking):
```ts
trackMuxUploadAttempt(props: { size: number; duration: number; format: string })
trackMuxUploadSuccess(props: { upload_id: string; size: number; duration: number })
trackMuxUploadFailure(props: { stage: 'poster' | 'create_upload' | 'put'; status?: number; error?: string })
```

### 4. XHR helper
Inline `putWithProgress(url, file, onProgress)` at the bottom of `mediaService.ts` — isolates `XMLHttpRequest` quirks (timeout, abort safety).

### 5. Photos + flag-off video: unchanged code path.

## Files touched
- `src/services/mediaService.ts` — flag, Mux branch, XHR helper.
- `src/services/analytics.ts` — three new events.
- `.env` — `VITE_MUX_UPLOAD_ENABLED=false`.

## Verification gates
1. Flag off, video upload → identical to today (`provider` undefined, Supabase URL, no Mux events, no `mux_uploads` row).
2. Flag off, image upload → identical.
3. Flag on, image upload → identical (gated on `isVideo`).
4. Flag on, video happy path → `MediaItem` has `provider:'mux'`, `mux_upload_id`, `mux_status:'preparing'`, `url` = non-empty poster URL. Row in `mux_uploads` with `status:'waiting'`. `mux_upload_attempt` + `mux_upload_success` fired.
5. Flag on, poster failure (force `generateVideoPoster` to throw) → toast, `mux_upload_failure` with `stage:'poster'`, no `mux-create-upload` call, no orphan poster.
6. Flag on, create_upload failure (sign out before upload) → toast, `mux_upload_failure` with `stage:'create_upload'`, poster cleanup attempted, no PUT, no `mux_uploads` row.
7. Flag on, PUT failure (kill network mid-PUT) → toast, `mux_upload_failure` with `stage:'put'`, poster cleanup attempted, composer recovers and retry works.
8. Browser preflight of `mux-create-upload` from the preview session (logged-in JWT) returns the snake_case contract above.
9. Post creation with a Mux MediaItem round-trips through JSONB; feed / lightbox / edit-mode preview all show poster + Processing badge (validated by 2A's guards — the payoff).

## Rollback
Set `VITE_MUX_UPLOAD_ENABLED=false` and redeploy. Existing Mux MediaItems keep rendering their poster via 2A's guards. No migration.

---

# Locked decisions for 3A/3B (no further debate)
- `mux_upload_mappings.mux_upload_id` → FK to `mux_uploads.upload_id` `ON DELETE CASCADE`. Verify `mux_uploads.upload_id` is `UNIQUE` in the 3A migration; add it if missing.
- Unique `(content_type, content_id, media_index)` on mappings.
- `patch_content_media_from_mux` is `SECURITY DEFINER`, validates `media[index].mux_upload_id` matches before patching.
- `mux-register-mappings` (JWT) does insert + catch-up. `mux-reconcile-upload` (service-role) is the manual requeue.
- Reviews stay in the schema enum but client wiring is post-only.

# Deferred (Phase 4+)
Playback, hls.js, Mux Player, signed playback, captions, storyboards, Mux Data, edit/reorder reconciliation, backfill of existing Supabase videos.
