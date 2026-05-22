# Phase 4 — Mux HLS Playback (FINAL LOCKED — ready to implement)

Step 0 (doc) + Phase 4 (frontend). Stop for verification before Phase 5. Phase order: **4 → 5 → 3C → 6**. 3C and 6 remain deferred.

---

## Step 0 — `.lovable/plan.md` Phase 3A doc correction (doc-only)

Align the doc with the deployed migration:
- `content_type CHECK IN ('post')` — post-only.
- `status` enum: `('pending','patched','orphaned','errored')`. `noop_*` are RPC return strings, never column values.
- Unique constraints: `mux_upload_id UNIQUE` + `UNIQUE(content_type, content_id, media_index)`.
- FK: `mux_upload_id REFERENCES mux_uploads(upload_id) ON DELETE CASCADE`.
- RPC: `patch_content_media_from_mux(p_mapping_id uuid) RETURNS text`, `SECURITY DEFINER`, EXECUTE granted to `service_role` only.
- RPC sets transaction-local `app.mux_system_patch='on'`; `enforce_post_edit_window` bypasses on that flag.
- Integrity: ready without `asset_id`/`playback_id` → mapping → `orphaned` with `last_error`, never `patched`.

---

## Phase 4 — locked scope

1. Mux ready + `mux_playback_id` → play via HLS.
2. Native HLS on Safari/iOS via `video.canPlayType('application/vnd.apple.mpegurl')`.
3. Lazy `hls.js` (dynamic import) on browsers without native HLS.
4. Preserve `FeedVideo` autoplay, mute, scrubber, milestones, view tracking, analytics, handoff snapshot.
5. **Preserve `LightboxPreview` first-tap iOS autoplay + `VideoHandoff` byte-for-byte** — change *only* source attachment.
6. Legacy Supabase `.mp4` / `.webm` unchanged; `hls.js` never loaded for them.
7. **No new components, no new visual states, no new props.** Reuse the existing `isMuxErrored` branch already in `MuxPreparingPoster` by widening the predicate it consumes.
8. **Out of scope:** Mux Player, captions, storyboards, Mux Data, signed URLs, redesign, edit reconciliation (3C), composer/webhook/DB changes.

---

## Centralized Mux state predicates (single source of truth)

In `src/utils/muxMedia.ts`, add and export:

```ts
export const isMuxPlayable = (m) =>
  isMuxItem(m) && m.mux_status === 'ready' && !!m.mux_playback_id;

export const isMuxReadyButBroken = (m) =>
  isMuxItem(m) && m.mux_status === 'ready' && !m.mux_playback_id;

// THE ONE predicate every renderer checks for the "errored poster" branch:
export const isMuxErroredOrBroken = (m) =>
  isMuxErrored(m) || isMuxReadyButBroken(m);
```

`FeedVideo`, `LightboxPreview`, and `MuxPreparingPoster` all consume `isMuxErroredOrBroken` — zero drift possible.

---

## Locked render branching order (codified in BOTH FeedVideo + LightboxPreview)

```ts
// 1. errored or broken-ready FIRST → errored poster, fire one-shot telemetry
if (isMuxErroredOrBroken(item)) {
  maybeEmitBrokenReady(item, (e, p) => analytics.track(e, p));
  return <MuxPreparingPoster item={item} ... />;
}
// 2. preparing → preparing poster
if (isMuxPreparing(item)) {
  return <MuxPreparingPoster item={item} ... />;
}
// 3. playable Mux → HLS <video>
// 4. legacy → plain <video src={item.url}>
```

Order is asserted in `src/utils/renderBranching.test.ts` via a pure `pickRenderBranch(item)` helper that feeds 5 synthetic items through and snapshots the result.

### Pure, dependency-free broken-ready telemetry (chatgpt's correction)

`muxMedia.ts` **must not import `@/services/analytics`**. The dedup `Set` stays inside the module; analytics is injected:

```ts
// muxMedia.ts — zero project-internal imports
type EmitFn = (event: string, props: Record<string, unknown>) => void;
const _brokenReadyEmitted = new Set<string>();

export const maybeEmitBrokenReady = (m: MediaItem, onEvent: EmitFn): void => {
  const key = m.mux_asset_id ?? m.id ?? m.url;
  if (!key || _brokenReadyEmitted.has(key)) return;
  _brokenReadyEmitted.add(key);
  onEvent('mux_ready_without_playback_id', {
    asset_id: m.mux_asset_id, playback_id: m.mux_playback_id ?? null,
  });
};
```

Callers inject `analytics.track` from the component. `muxMedia.ts` stays a pure utility — no import cycles.

---

## `attachHls` — async-safe, analytics-decoupled, leak-instrumented

`src/utils/hlsAttach.ts` (new, zero internal imports):

```ts
export type AttachToken = { cancelled: boolean };
export type HlsTelemetry = (event: string, props: Record<string, unknown>) => void;
export interface AttachHlsOptions { onEvent?: HlsTelemetry }

export function attachHls(
  video: HTMLVideoElement,
  src: string,
  token: AttachToken,
  opts: AttachHlsOptions = {},
): () => void {
  const emit = opts.onEvent ?? (() => {});
  let hls: import('hls.js').default | null = null;

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    if (token.cancelled) return () => {};
    video.src = src;
    return () => { try { video.removeAttribute('src'); video.load(); } catch {} };
  }

  import('hls.js').then(({ default: Hls }) => {
    if (token.cancelled) return;
    if (!Hls.isSupported()) { video.src = src; return; }
    hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30 });
    if (import.meta.env.DEV) (window as any).__muxHlsLive = ((window as any).__muxHlsLive ?? 0) + 1;
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data?.fatal) return;
      emit('mux_hls_fatal', { src, type: data.type });
      try { hls?.destroy(); } catch {}
      if (import.meta.env.DEV) (window as any).__muxHlsLive--;
      hls = null;
      if (!token.cancelled) video.src = src;
    });
    hls.loadSource(src);
    hls.attachMedia(video);
  }).catch((err) => {
    emit('mux_hls_load_failed', { src, err: String(err) });
    if (!token.cancelled) video.src = src;
  });

  return () => {
    try { hls?.destroy(); } catch {}
    if (hls && import.meta.env.DEV) (window as any).__muxHlsLive--;
    hls = null;
    try { video.removeAttribute('src'); video.load(); } catch {}
  };
}
```

---

## `LightboxPreview` handoff invariants (static gate)

Add a comment block at the top of `LightboxPreview.tsx`:

```tsx
/**
 * 🚫 HANDOFF INVARIANTS — DO NOT VIOLATE
 *  1. <video>.currentTime is set from initialVideoState.currentTime BEFORE play().
 *  2. <video>.muted is initialized from initialVideoState.muted (global mute intent).
 *  3. If initialVideoState.wasPlaying, play() is invoked once on loadedmetadata.
 *  4. First user tap on iOS triggers play()+unmute synchronously inside the handler.
 *  5. Mux source attachment via attachHls() runs AFTER (1)-(2) wiring, not before.
 * Regression of any of the above breaks iOS lightbox handoff.
 * Backed by LightboxPreview.handoff.test.tsx — failing test blocks merge.
 */
```

Plus `src/components/media/LightboxPreview.handoff.test.tsx` — minimal RTL test asserting `muted`, `currentTime`, and exactly one `play()` call after `loadedmetadata` with mocked `initialVideoState={ currentTime: 12.3, wasPlaying: true, muted: false }`.

---

## Files touched (9 total)

| # | File | Change |
|---|---|---|
| 1 | `src/utils/muxMedia.ts` | Add `muxHlsUrl`, `muxThumbnailUrl`, `isMuxPlayable`, `isMuxReadyButBroken`, `isMuxErroredOrBroken`, `maybeEmitBrokenReady(item, onEvent)`. Patch `muxPosterUrl` to prefer `muxThumbnailUrl(playback_id)` over `m.url` when playback_id present. **Zero new imports from project code.** |
| 2 | `src/utils/hlsAttach.ts` | **New.** Pure utility, no analytics import. |
| 3 | `src/utils/renderBranching.ts` | **New.** `pickRenderBranch(item)` pure helper. |
| 4 | `src/utils/renderBranching.test.ts` | **New.** Snapshot the 5-state matrix. |
| 5 | `src/components/media/MuxPreparingPoster.tsx` | Swap `isMuxErrored(item)` for `isMuxErroredOrBroken(item)` in the errored-branch predicate. One-line change. |
| 6 | `src/components/media/FeedVideo.tsx` | Replace top-of-component early return with locked branching order; replace `<video src={item.url}>` with attach effect that calls `attachHls` for Mux-playable items and sets `video.src` for legacy. |
| 7 | `src/components/media/LightboxPreview.tsx` | Add handoff-invariants comment block; swap source attachment for `attachHls`; iOS sequencing untouched. |
| 8 | `src/components/media/LightboxPreview.handoff.test.tsx` | **New.** Handoff invariants merge gate. |
| 9 | `package.json` | Add `hls.js` (lazy import only). |

---

## Effect pattern (both video components)

```ts
useEffect(() => {
  const v = videoRef.current;
  if (!v) return;
  const { src, isHls } = resolveVideoSrc(item);
  if (!src) return;
  const token: AttachToken = { cancelled: false };
  const detach = isHls
    ? attachHls(v, src, token, { onEvent: (e, p) => analytics.track(e, p) })
    : (() => { v.src = src; return () => { try { v.removeAttribute('src'); v.load(); } catch {} }; })();
  return () => { token.cancelled = true; detach(); };
}, [item.url, item.mux_playback_id, item.mux_status]);
```

---

## Verification (sequenced)

1. **Chrome desktop** on Phase 3B test post → hls.js loads on demand, plays, scrubber/mute/autoplay intact.
2. **iOS Safari** → native HLS, autoplay-muted-inline, **no** `hls.js` network request.
3. **Desktop Safari** → native HLS.
4. **🚧 BLOCKING — iOS handoff regression gate.** Feed → tap → lightbox resumes at same `currentTime`, same play/pause, respects global mute. First-tap autoplay on iPhone still works. `LightboxPreview.handoff.test.tsx` must pass.
5. **Legacy `.mp4`** → unchanged, hls.js never requested.
6. **Preparing item** → preparing poster, poster falls back to `muxThumbnailUrl`, `<video>` never mounts.
7. **Errored item** (`mux_status='errored'`) → errored poster, `<video>` never mounts.
8. **Broken-ready** (synthetic `mux_status='ready'`, `mux_playback_id=null`) → errored poster, `mux_ready_without_playback_id` fires **exactly once** even after scrolling past it 10 times.
9. **hls.js import blocked** (DevTools request-block) → `mux_hls_load_failed` fires, fallback `video.src = src`, no crash.
10. **🚧 BLOCKING — Deterministic unmount-race check:**
    - `window.__muxHlsLive === 0` on fresh feed load.
    - Scroll past 30 Mux posts rapidly, wait 2s → `window.__muxHlsLive === 0` again.
    - Console has **zero** `mux_hls_fatal` events post-unmount.
    - `performance.getEntriesByType('resource').filter(r => r.name.includes('hls.js')).length === 1`.
11. **Branching test** — `renderBranching.test.ts` passes; all 5 states map to the locked order.
12. **Bundle check** — `hls.js` chunk only fetched in scenarios 1, 9, 10. Never iOS/Safari, never legacy.

---

## Rollback

Revert the two `useEffect` source-attach blocks. Revert the one-line predicate widening in `MuxPreparingPoster`. Remove `hls.js` from `package.json`. New helpers + test files can stay as dead code.

---

## Final deltas vs prior revision

| Change | Source | Why |
|---|---|---|
| `maybeEmitBrokenReady(item, onEvent)` — callback-injected | chatgpt | Keeps `muxMedia.ts` pure, no analytics import cycle |
| File count locked at **9** | codex | Matches the actual touched files list |
| Render branching order: errored/broken → preparing → playable → legacy | chatgpt (reaffirmed) | Prevents `mux_status='errored'` matching a "not ready" check |

---

Approve to proceed. Step 0 + Phase 4 implement in the next turn. Stop for verification before Phase 5. **No further plan iterations.**
