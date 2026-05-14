## Goal
Make the upload progress feel alive on slow internet. Today the bar sits at 0% until Supabase finishes, then jumps to 100% — looks frozen. Fix with a **staged + smoothly animated** progress UI. No upload-pipeline rewrite.

## Why staged (not real bytes)
`supabase.storage.from('post_media').upload(...)` is `fetch`-based and does not expose byte-level progress. Real % would require XHR or signed upload URLs — out of scope. The actual user pain is "is this frozen?", not "what % exactly?".

## Changes

### 1. `src/services/mediaService.ts` — emit stage events
Add an optional second arg to the `onProgress` callback so it can report stages:
- `'preparing'` — fired right after the function is entered (videos and images)
- `'uploading'` — fired right before `supabase.storage...upload(...)` for the main file
- `'finalizing'` — fired right after upload returns, before building the `MediaItem`
- `'done'` — fired at the very end

Backwards compatible: old `onProgress(100)` numeric calls stay (used as the "done" signal by older callers, if any).

### 2. `src/types/media.ts` — add stage to upload state
```ts
stage?: 'preparing' | 'uploading' | 'finalizing' | 'done';
```

### 3. `src/components/media/MediaUploader.tsx` — drive a smooth bar

**Start movement immediately** (ChatGPT point #4): when the upload row is first added (before validation / poster gen / network), set `stage: 'preparing'` and kick off the animator on the same frame.

Pass a stage handler into `uploadMedia` that updates `stage` on the matching upload row when each milestone fires.

**Smooth animator** (replaces the current 0→100 jump):
- A `requestAnimationFrame` loop per in-flight row eases `progress` toward a per-stage **ceiling**:
  - `preparing` → ceiling 15%
  - `uploading` → ceiling 90%
  - `finalizing` → ceiling 97%
  - `done` → snap to 100%, then row removes (existing instant-handoff behavior)
- Easing: `next = current + max((ceiling - current) * 0.04, 0.15)` per frame — guarantees a **minimum forward creep** so the bar never visually freezes when it nears a ceiling on very slow connections (ChatGPT point #2). Capped at the ceiling.
- Cleanup the rAF on row removal / unmount / error.

**No percentage text** (ChatGPT point #1): show only the stage label, not a number.

### 4. `src/components/media/MediaUploader.tsx` — stage label + shimmer in `UploadRow`
Under the file name, show a small status line that reflects `stage`:
- `Preparing video…` (videos) / `Preparing…` (images)
- `Uploading…`
- `Finalizing…`
- (no label once `done` — row disappears immediately)

**Subtle shimmer overlay** on the progress bar while not in `done`/`error` state (ChatGPT point #2 belt-and-suspenders): a thin diagonal gradient sliding across the filled portion, reusing the existing `animate-pulse` or a small bespoke `bg-gradient-to-r ... animate-[shimmer_1.6s_linear_infinite]`. Add the keyframe in `tailwind.config.ts` only if not already present. No new deps.

### 5. Error path (ChatGPT point #5)
On error: stop the rAF, leave `progress` where it is, set `status: 'error'`, hide shimmer, keep row visible until user dismisses. Unchanged behavior, just animation stops cleanly.

### 6. Cancel (ChatGPT point #3)
Cancel keeps current behavior — removes the row from the UI and stops the animator/rAF. We do **not** add an `AbortController` to the Supabase upload in this pass; the in-flight network request continues in the background as it does today. Documented in code comment.

### 7. (My addition) Safety cap on `preparing`
If `generateVideoPoster` / `validateMediaFile` somehow take > 8s, the bar will already be parked at the 15% ceiling with shimmer running — fine. But add a tiny guard: if `stage` is still `preparing` after 10s with no transition, bump ceiling to 25% so it visibly nudges once more. Cheap reassurance against pathological cases (huge MOV on a slow CPU).

### 8. (My addition) Reduced motion
Wrap the shimmer keyframe in `motion-safe:` so users with `prefers-reduced-motion: reduce` only see the eased bar, no shimmer. Aligns with existing a11y norms in the project.

## Out of scope
- No XHR/signed-URL rewrite, no edge function changes, no schema changes, no new deps.
- No `AbortController` wiring.
- No changes to `FeedVideo`, `useVideoMute`, composer layout, or any other component.

## Verification
- DevTools → Network → "Slow 3G", upload a 40 MB MOV:
  - Row appears with `Preparing video…` + bar already creeping from 0.
  - Transitions to `Uploading…`; bar smoothly creeps toward ~90% with visible shimmer; never sits still for more than a frame.
  - On completion: snaps to 100, row vanishes instantly (existing handoff), final preview is already there.
- Image upload: same staged feel, label says `Preparing…` then `Uploading…`.
- Cancel mid-upload: row disappears, animator stops, no console errors. (Network request continues in background — pre-existing behavior.)
- Failed upload (e.g. force a 4xx): animator stops, bar stays where it was, `✗` shows, row remains until cancelled.
- `prefers-reduced-motion: reduce`: bar still eases; shimmer is gone.