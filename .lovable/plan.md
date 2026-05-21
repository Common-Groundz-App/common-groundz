## What's actually happening

This is **not** caused by the "free test asset" banner. Mux test assets are fully playable (10s + watermark); that warning only affects the asset itself, not how our app renders it.

The real cause is a second field-stripping bug, this time on the **read path**.

### Evidence

1. DB row for the latest Hana Li post (`d4941fd5…`) is correct:
   ```
   provider: 'mux'
   mux_upload_id: 'eao9KW2FGIJrTJmze013mAmNn2zlZ2p6lWQKuYhCCpEM'
   mux_status: 'preparing'
   thumbnail_url: …_poster.jpg
   url: …_poster.jpg
   ```
   So the write-path fix from last turn worked.

2. `FeedVideo.tsx` has the Phase 2A guard (line 178) — it would render `MuxPreparingPoster` if `isMuxPreparing(item)` returned true.

3. But `src/hooks/feed/api/utils.ts` `processMediaItems()` (lines 27–57) builds a fresh object and **omits** `provider`, `mux_upload_id`, `mux_asset_id`, `mux_playback_id`, `mux_status`, `mux_error`. By the time `FeedVideo` receives the item, `provider` is `undefined`, so `isMuxPreparing()` returns `false`, and we mount `<video src=poster.jpg>` → the browser fails because a JPEG isn't a video → "This video format isn't supported on your device."

4. Console confirms: `Analytics Event: video_played … src: …_poster.jpg` — a `<video>` is being mounted with the poster JPG as src.

### About the Mux "Ready" status

Even after we fix the field passthrough, the feed will keep showing **"Processing video…"** (poster + spinner badge) and never auto-flip to a playing video. That's because Phase 2A/2B do not yet include the webhook that updates `mux_status` from `preparing` → `ready` and writes `mux_playback_id`. That's a separate phase (2C / Phase 3) and is the expected state right now.

No additional data from Mux is needed for this fix.

## Plan

### Step 1 — Fix `processMediaItems` to pass Mux fields through (the actual bug)

File: `src/hooks/feed/api/utils.ts`

Add to the returned object (conditionally, same style as the composer fix):
- `provider`
- `mux_upload_id`
- `mux_asset_id`
- `mux_playback_id`
- `mux_status`
- `mux_error`

This is a 6-line additive change inside the existing `media.map(...)` return.

### Step 2 — Audit other read-path mappers for the same omission

Quick grep for any other place that reconstructs `MediaItem` from DB JSON and may also be stripping Mux fields:
- `src/services/postService.ts`
- `src/services/recommendation/*`
- `src/services/feedContentService.ts`
- `src/hooks/feed/api/recommendations*`
- post-detail / PostView fetchers

Only patch the ones that actually rebuild the object (whitelist style). Mappers that do `...item` already pass Mux fields through.

### Step 3 — Verify

After patching, reload `/home`:
- Hana Li's post should now render the **poster + "Processing video…" badge**, not the broken `<video>` error.
- No `video_played` analytics event for the poster JPG.
- DB row is unchanged (read-only fix).

### Step 4 — Document the gap to "Ready"

Note in `.lovable/plan.md` that the poster + "Processing" state is now the correct terminal state until Phase 2C/3 ships the Mux webhook → DB update for `mux_status` and `mux_playback_id`. After that, `isMuxPreparing()` will return `false` and `FeedVideo` will mount a real Mux player.

## Out of scope (for this fix)

- Mux webhook + `mux_status`/`mux_playback_id` updater (next phase).
- Mux HLS player component (next phase).
- Removing the `VITE_MUX_UPLOAD_ENABLED=true` flag — keep on until end-to-end works, then flip off as planned at Gate 4.
