# Micro-edit + Tier 2 (final) — Time-Aware HLS Prewarm

Three independent pieces:
1. One-line comment tightening in `corsSafeHosts.ts`.
2. Tier 2 — prewarm Mux HLS manifest + media playlist + the segment near the tapped `currentTime`, with **success-gated dedup**, Data Saver respect, and a runtime override hook.
3. No Settings UI added — we honor the browser/OS Data Saver signal directly.

## Part 1 — `corsSafeHosts.ts` comment micro-edit

Replace the misleading JSDoc line on the `*.supabase.co` / `*.supabase.in` matcher with:

> "Covers Supabase-owned subdomains only (Storage, transformation CDN, project hosts). Custom/proxied domains pointed at Supabase are NOT matched — add explicitly if needed."

Zero behavior change.

## Part 2 — Tier 2: Time-aware HLS Prewarm

### Changes from previous draft

| Issue (reviewer) | Fix in this plan |
|---|---|
| Dedup poisons future retries when fetch fails/aborts (ChatGPT — main issue) | Two-set model: `_inFlight` set during fetch, `_warmed` set **only after** a successful response. Failure/abort never marks warmed. |
| No Data Saver guard (ChatGPT) | First-line check: `navigator.connection?.saveData === true` → return. No Settings UI — OS/browser already exposes this. |
| Kill-switch comment falsely implied no-redeploy (ChatGPT) | Comment rewritten: "disables prewarm without touching call sites. Still a code constant — to flip without rebuild, see `setPrewarmEnabled()`." |
| Need runtime kill switch (Codex) | Module exports `setPrewarmEnabled(bool)`. A future 4-line `useEffect` in `App.tsx` can wire it to an `app_config` flag. The mechanism ships now; the DB flag is out of scope for Tier 2. |
| Bonus: visibility hidden | `document.addEventListener('visibilitychange', ...)` aborts the in-flight controller when the tab goes hidden. |

### Why the success-gated dedup matters

Old behavior (broken):
```
tap (weak network) → add to _warmed → fetch fails → key stays in _warmed
   → next tap → skipped, even though nothing was actually cached
```

New behavior:
```
tap → add to _inFlight (dedups concurrent re-taps on same key)
    → fetch succeeds → promote to _warmed
    → fetch fails/aborts → remove from _inFlight, never touch _warmed
    → next tap → retries cleanly
```

### Why we skip the Settings UI for Data Saver

`navigator.connection.saveData` is **already controlled by the user** at the OS/browser level (Chrome "Lite mode", Android Data Saver, etc.). Adding a redundant toggle in our Settings tab would:
- Duplicate a system-level preference the user has already expressed.
- Couple Tier 2 to settings UI work (out of scope for a perf change).
- Be ignored by most users who don't know it exists.

If we ever want a per-app override later, it's a one-line addition. Skipping it now keeps Tier 2 surgical.

### Scope (unchanged from previous draft)

- New utility: `src/utils/prewarmMuxHls.ts`.
- One added call (+1 import) in `FeedVideo.handleContainerClick`.
- No change to `hlsAttach.ts`, `LightboxPreview.tsx`, `PostMediaDisplay.tsx`, `FeedCollage.tsx`, `muxMedia.ts`, `useVideoMute`, `useVideoAutoplay`, composer, DB, edge functions, feed queries.
- No new render path, no hidden `<video>`, no early `Hls` instance, no IntersectionObserver/scroll-based prewarm. Tap-only.

### Files

| File | Change |
|---|---|
| `src/utils/corsSafeHosts.ts` | Part 1 comment only. |
| `src/utils/prewarmMuxHls.ts` (new) | `prewarmMuxHls(playbackId, currentTime?)` + `setPrewarmEnabled(bool)` export. Two-tier success-gated dedup, Data Saver guard, visibility abort. |
| `src/components/media/FeedVideo.tsx` | One call + two imports in `handleContainerClick`. |

### Behavior on tap

1. **Kill-switch + Data Saver gate.** If `!prewarmEnabled` OR `navigator.connection?.saveData === true` → return immediately.
2. **hls.js chunk warmup.** `void import('hls.js')` — fire-and-forget. Harmless on Safari/iOS (module loads but is never instantiated).
3. **Master playlist** at `https://stream.mux.com/{id}.m3u8`:
   - If `playbackId` is in `_warmedMaster` OR `_inFlightMaster` → skip step.
   - Else add to `_inFlightMaster`, fetch with `cache: 'default', mode: 'cors', credentials: 'omit'`, 4s AbortController, also aborted on `visibilitychange → hidden`.
   - On success: parse first non-comment line → child URL. Remove from `_inFlight`, add to `_warmedMaster`.
   - On failure/abort: remove from `_inFlight`. Never touch `_warmed`. Abort the whole chain.
4. **Media playlist** (resolved child URL): same in-flight/warmed pattern keyed by `playbackId` in `_inFlightMedia` / `_warmedMedia`.
   - Single-rendition edge case: if the child URL doesn't end in `.m3u8`, treat it as a direct segment and fetch under the segment dedup key instead.
5. **Segment**: bucket key = `${playbackId}@${Math.floor(currentTime / 10)}`. Same in-flight/warmed pattern with `_inFlightSegments` / `_warmedSegments`.
   - Target segment selected by walking `#EXTINF:<dur>,` lines and the following segment URL until cumulative time >= `currentTime`.
   - Parse failure → first-segment fallback. Both end of playlist and any malformed structure fall back silently.

All `fetch` calls are wrapped in try/catch and never throw. No console noise except in dev (gated on `import.meta.env.DEV`).

### Key snippets

#### `src/utils/prewarmMuxHls.ts`

```ts
import { muxHlsUrl } from '@/utils/muxMedia';

/**
 * Default kill switch — disables prewarm without touching call sites.
 * NOTE: this is a code constant, so flipping it still requires rebuild/redeploy.
 * For true runtime control, call setPrewarmEnabled(false) from a React effect
 * that reads an app_config flag (not wired in Tier 2; mechanism only).
 */
let _prewarmEnabled = true;
export const setPrewarmEnabled = (enabled: boolean): void => {
  _prewarmEnabled = enabled;
};

const SEGMENT_BUCKET_SECONDS = 10;
const PREWARM_TIMEOUT_MS = 4000;

// Success-gated dedup. Keys are added to _inFlight* on request start and to
// _warmed* ONLY after a 2xx response. Failure/abort removes from _inFlight*
// without touching _warmed*, so retries work after weak-network failures.
const _inFlightMaster = new Set<string>();
const _warmedMaster = new Set<string>();
const _inFlightMedia = new Set<string>();
const _warmedMedia = new Set<string>();
const _inFlightSegments = new Set<string>();
const _warmedSegments = new Set<string>();

const isSaveDataOn = (): boolean => {
  try {
    return Boolean((navigator as any)?.connection?.saveData);
  } catch { return false; }
};

const fetchOpts = (signal: AbortSignal): RequestInit => ({
  method: 'GET',
  mode: 'cors',
  credentials: 'omit',
  cache: 'default',
  signal,
});

function firstResourceLine(text: string): string | null {
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (l.length > 0 && !l.startsWith('#')) return l;
  }
  return null;
}

function pickSegmentAt(text: string, targetTime: number): string | null {
  const lines = text.split('\n').map((l) => l.trim());
  let cumulative = 0;
  let pendingDur = 0;
  let lastSegment: string | null = null;
  for (const l of lines) {
    if (l.startsWith('#EXTINF:')) {
      const m = l.match(/^#EXTINF:([\d.]+)/);
      pendingDur = m ? parseFloat(m[1]) : 0;
    } else if (l.length > 0 && !l.startsWith('#')) {
      lastSegment = l;
      if (cumulative + pendingDur >= targetTime) return lastSegment;
      cumulative += pendingDur;
      pendingDur = 0;
    }
  }
  return lastSegment;
}

export function prewarmMuxHls(
  playbackId: string | null | undefined,
  currentTime: number = 0,
): void {
  if (!_prewarmEnabled || !playbackId) return;
  if (isSaveDataOn()) return;

  // Harmless on Safari (hls.js never instantiates there).
  try { void import('hls.js'); } catch { /* ignore */ }

  const target = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  const segmentKey = `${playbackId}@${Math.floor(target / SEGMENT_BUCKET_SECONDS)}`;

  const needMaster = !_warmedMaster.has(playbackId) && !_inFlightMaster.has(playbackId);
  const needMedia = !_warmedMedia.has(playbackId) && !_inFlightMedia.has(playbackId);
  const needSegment = !_warmedSegments.has(segmentKey) && !_inFlightSegments.has(segmentKey);
  if (!needMaster && !needMedia && !needSegment) return;

  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), PREWARM_TIMEOUT_MS);
  const onHide = () => { if (document.visibilityState === 'hidden') ac.abort(); };
  document.addEventListener('visibilitychange', onHide);
  const cleanup = () => {
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onHide);
  };

  if (needMaster) _inFlightMaster.add(playbackId);
  if (needMedia) _inFlightMedia.add(playbackId);
  if (needSegment) _inFlightSegments.add(segmentKey);

  const masterUrl = muxHlsUrl(playbackId);

  (async () => {
    let masterText: string | null = null;
    let mediaUrl: string | null = null;

    try {
      // ---- Master ----
      if (needMaster || needMedia || needSegment) {
        const r = await fetch(masterUrl, fetchOpts(ac.signal));
        if (!r.ok) return;
        masterText = await r.text();
        if (needMaster) {
          _inFlightMaster.delete(playbackId);
          _warmedMaster.add(playbackId);
        }
      }

      const childRel = masterText ? firstResourceLine(masterText) : null;
      if (!childRel) return;
      const childUrl = new URL(childRel, masterUrl).toString();

      // Single-rendition asset: master IS the playlist, child is a segment.
      if (!childUrl.endsWith('.m3u8')) {
        if (needSegment) {
          const r = await fetch(childUrl, fetchOpts(ac.signal));
          if (r.ok) {
            _inFlightSegments.delete(segmentKey);
            _warmedSegments.add(segmentKey);
          }
        }
        return;
      }

      mediaUrl = childUrl;

      // ---- Media playlist ----
      let mediaText: string | null = null;
      if (needMedia || needSegment) {
        const r = await fetch(mediaUrl, fetchOpts(ac.signal));
        if (!r.ok) return;
        mediaText = await r.text();
        if (needMedia) {
          _inFlightMedia.delete(playbackId);
          _warmedMedia.add(playbackId);
        }
      }

      // ---- Segment at currentTime, fallback first ----
      if (needSegment && mediaText) {
        const segRel = pickSegmentAt(mediaText, target) ?? firstResourceLine(mediaText);
        if (!segRel) return;
        const segUrl = new URL(segRel, mediaUrl).toString();
        const r = await fetch(segUrl, fetchOpts(ac.signal));
        if (r.ok) {
          _inFlightSegments.delete(segmentKey);
          _warmedSegments.add(segmentKey);
        }
      }
    } catch {
      /* AbortError / network / CORS — silent by design */
    } finally {
      // Drop any still-inflight keys so a later tap can retry.
      if (_inFlightMaster.has(playbackId) && !_warmedMaster.has(playbackId)) {
        _inFlightMaster.delete(playbackId);
      }
      if (_inFlightMedia.has(playbackId) && !_warmedMedia.has(playbackId)) {
        _inFlightMedia.delete(playbackId);
      }
      if (_inFlightSegments.has(segmentKey) && !_warmedSegments.has(segmentKey)) {
        _inFlightSegments.delete(segmentKey);
      }
      cleanup();
    }
  })();
}
```

#### `FeedVideo.tsx` — single call site

Inside `handleContainerClick`, after the snapshot block and before `onTap(handoff, extras)`:

```ts
// Tier 2: kick off HLS prewarm in parallel with the open animation.
// Pass v.currentTime so we target the segment the lightbox will actually need.
if (isMuxPlayable(item) && item.mux_playback_id && v) {
  prewarmMuxHls(item.mux_playback_id, v.currentTime);
}
```

Imports:
```ts
import { isMuxPlayable } from '@/utils/muxMedia';
import { prewarmMuxHls } from '@/utils/prewarmMuxHls';
```

### Verification

1. **Cold Mux tap at t=0** → `.m3u8` master, `.m3u8` media, and first segment all fetched. Lightbox `loadeddata` arrives noticeably faster.
2. **Cold Mux tap at t≈45s** → segment near 45s prefetched, not segment 0.
3. **Same item tapped twice within 10s bucket** → full dedup hit, zero network.
4. **Weak network: tap fails mid-fetch** → keys removed from `_inFlight`, NOT added to `_warmed`. Next tap on same item refires prewarm. ✅ ChatGPT's main concern.
5. **Concurrent re-tap during in-flight fetch** → second tap sees `_inFlight` hit, no duplicate request.
6. **Data Saver on** (Chrome DevTools → Network → "Data Saver") → `prewarmMuxHls` returns at first line; no fetches.
7. **Tab hidden mid-fetch** → AbortController fires, fetches stop, no console noise.
8. **`setPrewarmEnabled(false)` called** → next tap returns at first line. Re-enable works symmetrically.
9. **Non-Mux video / preparing item** → guard skips prewarm.
10. **Single-rendition Mux asset** → segment path runs; media path correctly skipped.
11. **Malformed playlist** → first-segment fallback or silent skip.
12. **Safari/iOS** → `import('hls.js')` resolves but module is unused; prefetches still warm Safari's HTTP cache.
13. **Tier 1 unaffected** — capture + `entryPosterDataUrl` flow untouched.
14. **`LightboxPreview.handoff.test.tsx`** — not touched.

### Out of scope

- Tier 3 (same-element DOM reparenting).
- DB `app_config` flag for runtime prewarm toggle (mechanism shipped via `setPrewarmEnabled`; wiring to a flag row is a future 5-minute follow-up).
- Settings tab toggle for Data Saver (browser/OS handles this).
- Variant pre-selection / bandwidth-aware prewarm (hls.js does this at attach time).
- Scroll-based or IntersectionObserver-driven prewarm.
- Service worker / Cache API persistence.
- Changes to `hlsAttach.ts`, `LightboxPreview.tsx`, `PostMediaDisplay.tsx`, `FeedCollage.tsx`, `muxMedia.ts`, composer, edge functions, feed queries.
