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

## Scope

### 1. Flag — `src/services/mediaService.ts`
```ts
const isMuxEnabled = () => import.meta.env.VITE_MUX_UPLOAD_ENABLED === 'true';
```
Default unset in repo `.env`. Local dev flips it on.

### 2. Mux branch in `uploadMedia` (videos only, flag on)
After validation + poster generation (we still need the poster for `url`/`thumbnail_url`):
1. `analytics.trackMuxUploadAttempt({ size, duration, format })`
2. `supabase.functions.invoke('mux-create-upload')` → `{ upload_id, upload_url }`. On error → `trackMuxUploadFailure({ stage: 'create_upload', error })` → throw user-facing `"Couldn't start video upload. Try again."`
3. PUT file to `upload_url` via XHR (for progress). On non-2xx/network error → `trackMuxUploadFailure({ stage: 'put', status, error })` → throw `"Video upload failed. Try again."`
4. Upload poster to Supabase storage (existing path) so `url`/`thumbnail_url` are populated.
5. `trackMuxUploadSuccess({ upload_id, size, duration })`
6. Return:
```ts
{
  id, type: 'video', provider: 'mux',
  mux_upload_id: upload_id, mux_status: 'preparing',
  url: posterUrl, thumbnail_url: posterUrl,
  width, height, duration, orientation,
  order: 0, session_id, caption: '', alt: file.name.split('.')[0],
}
```

**No fallback to Supabase on failure.** Hard fail, existing composer error handling takes over.

### 3. Telemetry — `src/services/analytics.ts`
Add `trackMuxUploadAttempt`, `trackMuxUploadSuccess`, `trackMuxUploadFailure({ stage: 'create_upload' | 'put', error, status? })`. Non-blocking.

### 4. Photos + flag-off video: unchanged code path.

## Verification gates
1. Flag off, video upload → identical to today (`provider` undefined, Supabase URL).
2. Flag off, image upload → identical.
3. Flag on, image upload → identical (gated on `isVideo`).
4. Flag on, video upload happy path → `MediaItem` has `provider:'mux'`, `mux_upload_id`, `mux_status:'preparing'`, `url` = poster URL. Row exists in `mux_uploads`. Analytics fires attempt + success.
5. Flag on, video upload failure (kill network mid-PUT) → toast, console log, failure analytics, no `MediaItem` returned, composer recovers.
6. Browser → `mux-create-upload` preflight: confirm callable from preview session (not just curl). One-time check before writing the branch.
7. Post creation with a Mux MediaItem persists, JSONB round-trips, **renderers show poster + Processing badge** (validated by 2A's guards — this is the payoff).

## Rollback
Set `VITE_MUX_UPLOAD_ENABLED=false`. Existing Mux items keep rendering their poster (2A guard handles them). No migration.

---

# Locked decisions for 3A/3B (no further debate)
- `mux_upload_mappings.mux_upload_id` → FK to `mux_uploads.upload_id` `ON DELETE CASCADE`. Verify `mux_uploads.upload_id` is `UNIQUE` in the 3A migration; add it if missing.
- Unique `(content_type, content_id, media_index)` on mappings.
- `patch_content_media_from_mux` is `SECURITY DEFINER`, validates `media[index].mux_upload_id` matches before patching.
- `mux-register-mappings` (JWT) does insert + catch-up. `mux-reconcile-upload` (service-role) is the manual requeue.
- Reviews stay in the schema enum but client wiring is post-only.

# Deferred (Phase 4+)
Playback, hls.js, Mux Player, signed playback, captions, storyboards, Mux Data, edit/reorder reconciliation, backfill of existing Supabase videos.
