# Phase 2 (final, v3) — Saved playback time & resume LRU

Folds in Codex's two latest points on top of v2:

- **Required:** source-swap detection now keys on **both** `stableSlotId` and `item.url`, so a `url` change with a stable `item.id` no longer leaks the old saved time to a new source.
- **Optional cleanup (taken):** `readFeedVideoResume()` promotes LRU recency on read, matching standard LRU semantics so frequently-revisited videos don't get evicted by 128 newer one-off entries.

All v2 safeguards (A pending-timeout finalizer, B stale-async activation token, C pause-capture sanity, D source-swap clears previous key, E near-zero clears at intent sites, F lightbox-race verification) and all earlier-round decisions (LRU cap 128, same `stableSlotId` as Phase 1, lightbox handoff writes to LRU, seek-before-play with `resumePendingRef` + `resumeTick`, session-only, no localStorage/DB, no Phase 3 manual-pause logic) are unchanged.

## Goal

When a managed feed video stops being the active slot (scroll-away, lightbox-open, tab-hide, manual pause, unmount), remember its `currentTime`. When the same slot becomes active again, **seek before play starts** so it resumes from where it left off instead of restarting at 0. Memory is session-only and bounded, the async resume cannot get stuck or apply stale values, and saved entries cannot leak across source swaps — including swaps that keep the same `stableSlotId`.

## Scope

In:
- Per-slot `currentTime` capture on deactivation, tab-hide, pause-while-active, unmount, lightbox-open.
- Per-slot resume on (re)activation, applied **before** the managed effect calls `play()`.
- Bounded LRU keyed by the same `stableSlotId` Phase 1 uses (`FeedVideo.tsx:268` — `item.id ?? "${sourceId ?? 'anon'}:${item.url}"`).
- Lightbox reverse-handoff time written into the LRU store when `resumeState` is consumed.
- Tab-session lifetime only.

Out (still deferred):
- Phase 3 manual-pause intent / `userPaused` per id / promote-on-manual-play / centralized manual pause logic.
- Any change to active-slot selection, mute, autoplay suppression, Mux/HLS attach, lightbox-quality, composer, DB, schema.

## Settings

- `FEED_VIDEO_RESUME_MAX = 128`
- `FEED_VIDEO_RESUME_MIN = 1.5` s
- `FEED_VIDEO_RESUME_TAIL = 1.0` s
- Pending-resume timeouts: 800 ms (`seeked`), 1500 ms (`loadedmetadata`)

## Manual-pause expectation

Phase 2 **only saves and resumes time**. If the user manually pauses an active video at 12s and scrolls away, the LRU stores 12s. When that slot later becomes active again, **whether it autoplays is governed entirely by existing Phase 1 behavior**. The video will seek to 12s before that autoplay starts. Manual-pause-blocks-autoplay is Phase 3 and **must not** be implemented here.

## New / updated safeguards (this round)

### Safeguard D (revised) — Source-swap clears the previous key, keyed on both `stableSlotId` AND `item.url`

Codex's correction: when `item.id` is present, `stableSlotId` doesn't change across an `item.url` swap, so the v2 effect would not fire. Track both and clear on either change.

```ts
const prevStableSlotIdRef = useRef<string | null>(null);
const prevItemUrlRef = useRef<string | null>(null);

useEffect(() => {
  const prevId = prevStableSlotIdRef.current;
  const prevUrl = prevItemUrlRef.current;
  const idChanged = prevId !== null && prevId !== stableSlotId;
  const urlChanged = prevUrl !== null && prevUrl !== item.url;

  if (idChanged || urlChanged) {
    // Clear the OLD key (which may equal the current key when only url changed
    // and id is stable — that's correct: stale saved time for this slot is gone).
    if (prevId !== null) clearFeedVideoResume(prevId);
    activationTokenRef.current++;        // invalidate in-flight resume
    resumePendingRef.current = false;    // finalize() from resume-effect cleanup also clears
  }

  prevStableSlotIdRef.current = stableSlotId;
  prevItemUrlRef.current = item.url;
}, [stableSlotId, item.url]);
```

Note: when only `item.url` changes and `stableSlotId` stays the same, clearing `prevId` (which equals current `stableSlotId`) is the correct behavior — the saved time belonged to the old source and must not carry over.

### Safeguard E — Near-zero at intentional capture sites *clears* instead of ignoring

Split capture in `FeedVideo.tsx`:
- `captureResumeFromPause()` — pause-event listener; applies Safeguard C (`readyState >= 1 && finite && currentTime > 0`), then `saveFeedVideoResume(...)`. Never clears (HLS re-attach can briefly pause at 0).
- `captureResumeFromIntent()` — deactivation/hide/unmount/lightbox-open. If `currentTime < MIN` → `clearFeedVideoResume(stableSlotId)`. Otherwise `saveFeedVideoResume(stableSlotId, time, duration)`.

### Safeguard A — Pending-timeout finalizer

`resumePendingRef` always clears via one of: `seeked`, 800 ms post-seek timeout, 1500 ms pre-metadata timeout, or effect cleanup. `finalize()` is idempotent and bumps `resumeTick`.

### Safeguard B — Stale-async activation token

`activationTokenRef` increments on slot active→inactive, source-swap (id or url), unmount. Resume effect captures `myToken`, `capturedEl`, `capturedUrl` at start; every async callback re-checks token/element/url/active before applying the seek; mismatch → `finalize(skip)`.

### Safeguard C — Pause-capture sanity

Inside `captureResumeFromPause()`: require `el.readyState >= 1 && Number.isFinite(el.currentTime) && el.currentTime > 0`.

### Safeguard F — Lightbox `resumeState` race (verification only)

Verify the existing `resumeState.apply()` path in `FeedVideo.tsx:362-413` does not produce a visible "play at 0, then jump" when the lightbox closes onto a simultaneously-activating feed slot. The existing code already uses `readyState >= 1` / `loadedmetadata`. If a flash is reproducible during verification step 3, gate the managed effect on `(resumePendingRef.current || lightboxResumePendingRef.current)` and bump the same `resumeTick` from `apply()`'s branches.

## Design

### A. New module — `src/hooks/useFeedVideoResumeStore.ts`

Pure module, no React. `Map<string, { time: number; updatedAt: number }>` used as LRU. SSR-safe.

```ts
export const FEED_VIDEO_RESUME_MAX  = 128;
export const FEED_VIDEO_RESUME_MIN  = 1.5;
export const FEED_VIDEO_RESUME_TAIL = 1.0;

export function saveFeedVideoResume(id: string, time: number, duration?: number): void;
export function readFeedVideoResume(id: string): number | null;
export function clearFeedVideoResume(id: string): void;
```

LRU mechanics — JS `Map` preserves insertion order, so re-set bumps recency. **Both write and read promote**:

- `saveFeedVideoResume(id, time, duration)`:
  - Reject non-finite / negative `time`.
  - `time < FEED_VIDEO_RESUME_MIN` → ignore (does not clear; clearing is the consumer's call per Safeguard E).
  - `duration` finite and `time >= duration - FEED_VIDEO_RESUME_TAIL` → `clearFeedVideoResume(id)` and return.
  - Otherwise: `store.delete(id); store.set(id, { time, updatedAt: Date.now() })` so this entry moves to the most-recent position. Evict oldest (`store.keys().next().value`) while `store.size > MAX`.
- **`readFeedVideoResume(id)` (LRU promote-on-read, Codex's optional cleanup, taken):**
  - Look up entry. If missing → return `null`.
  - Otherwise: `store.delete(id); store.set(id, entry)` to promote recency, then return `entry.time`.
  - This means a video the user keeps revisiting stays warm even if 128+ new videos are seen between visits.

### B. `FeedVideo.tsx` integration

New refs/state:
- `resumePendingRef = useRef(false)`
- `activationTokenRef = useRef(0)`
- `prevStableSlotIdRef = useRef<string | null>(null)`
- `prevItemUrlRef = useRef<string | null>(null)`
- `const [resumeTick, setResumeTick] = useState(0)`
- `slotIsActiveRef` already exists from Phase 1.1.

Effects (in this order so the managed effect sees the pending flag in the same commit):

1. **Source-swap effect** — Safeguard D (revised), depends on `[stableSlotId, item.url]`.
2. **Resume-on-activation effect** — depends on `[managed, slotIsActive, stableSlotId, item.url, resumeState]`. Runs when `managed && slotIsActive` becomes true. If `resumeState` is present → return (lightbox owns this activation). Else read `readFeedVideoResume(stableSlotId)` (which now also promotes recency); `null` → no-op. Otherwise set `resumePendingRef.current = true`, capture token/el/url, run timeout-bounded seek flow (Safeguard A) gating every async step on captured identity (Safeguard B), call idempotent `finalize()` exactly once. Cleanup → `finalize()`.
3. **Managed playback effect** (existing Phase 1.1) — add `if (resumePendingRef.current) return;` at the top. `resumeTick` added to deps.

Capture wiring:
- `slotIsActive` true → false (transition effect cleanup) → `captureResumeFromIntent()`.
- `document.visibilitychange` → hidden while active → `captureResumeFromIntent()`.
- Element `pause` event while active → `captureResumeFromPause()` (Safeguard C).
- Component unmount while active → `captureResumeFromIntent()`.
- Existing `resumeState.apply()` path — after `currentTime` set, before `onResumeConsumed?.()`, call `saveFeedVideoResume(stableSlotId, applied, v.duration)` so the lightbox-applied time wins over older LRU.
- `ended` handler → `clearFeedVideoResume(stableSlotId)`.

### C. Precedence on activation

```
1. resumeState (lightbox close, one-shot via onResumeConsumed) — also writes to LRU
2. LRU readFeedVideoResume(stableSlotId) — read also promotes recency
3. fresh start (currentTime stays 0)
```

## Edge cases

- **`item.id` stable, `item.url` swaps** → Safeguard D's url-watch fires, old key cleared, token bumped, in-flight resume skipped. **(This is the v3 fix.)**
- **`item.id` absent, fallback key encodes url** → both `stableSlotId` and `item.url` change; same effect fires (idChanged branch).
- **Frequently-revisited video amid heavy scrolling** → read-promote keeps it warm; LRU eviction targets truly stale entries.
- **Browser doesn't fire `seeked`** → 800 ms timeout finalizes.
- **Metadata never loads** → 1500 ms timeout finalizes as skip; video plays from 0.
- **User scrolls away during async wait** → token mismatch → skip.
- **Element replaced mid-resume** → `capturedEl !== videoRef.current` → skip.
- **Pause from HLS re-attach at t=0** → Safeguard C blocks save; old entry survives correctly.
- **User restarts, watches 0.4s, scrolls away** → Safeguard E clears old 12s; next activation starts fresh at 0.
- **Duration unknown at save time** → save raw; tail-clear only when finite. Resume clamps with `min(time, max(0, dur - 0.05))`.
- **Reload** → no persistence. Intentional.
- **Unmanaged surfaces** → all Phase 2 effects early-return.

## Files touched

- **new** `src/hooks/useFeedVideoResumeStore.ts` — note both `save` and `read` perform `delete`-then-`set` for LRU recency.
- `src/components/media/FeedVideo.tsx` — four new refs (`resumePendingRef`, `activationTokenRef`, `prevStableSlotIdRef`, `prevItemUrlRef`) + `resumeTick`, source-swap effect (Safeguard D revised, deps `[stableSlotId, item.url]`), resume-on-activation effect (Safeguards A/B/E), guard at top of managed effect, capture wiring split between intent vs pause sites, `ended` clear, lightbox `apply()` LRU write.

No other files change. No DB, no edge function, no schema, no manager/provider change, no mute/autoplay change.

## Verification

1. Play to ~5s → scroll away → scroll back → resumes at ~5s, **no visible jump from 0**.
2. Watch to end → starts at 0.
3. Lightbox open at 8s, scrub to 20s, close → resumes at 20s. Scroll away/back → still 20s. **(Safeguard F)** Watch for 0→20 flash; if observed, gate as described.
4. Open ~150 different videos → memory bounded; oldest evicts.
5. Manual pause at 12s → resumes at 12s. **Video may autoplay** — expected for Phase 2.
6. Tab hide at 7s → show → 7s.
7. Reload → all videos start at 0.
8. Unmanaged surface → no resume behavior.
9. Mux + plain MP4 both resume correctly.
10. **Safeguard A** — throttle network so `loadedmetadata` is slow; resumes once metadata arrives **or** plays from 0 after 1.5s; never stuck paused.
11. **Safeguard B** — rapidly swipe past a video as it activates; no seek to old time on a different slot.
12. **Safeguard C** — HLS re-attach near start; no spurious save overwrites real prior time with 0.
13. **Safeguard D (v3) — url swap with stable id** — render a card with `item.id = "X"` and url A; let it save at 8s. Update the same card to `item.id = "X"` with url B (e.g. via refetch or admin re-encode). Verify the new url starts at 0, **not** 8s. Verify any in-flight resume from before the swap does not apply after.
14. **Safeguard D — id change** — id-derived key changes; old key cleared, new url starts fresh.
15. **Safeguard E** — save at 12s, scrub to 0, watch 0.4s, scroll away → back → starts at 0.
16. **LRU read-promote** — open videos in order V1…V128, then scroll back to V1 and let it save again at 3s. Now open V129…V200 (which exceeds cap). Scroll back to V1 → V1 still resumes at 3s (was promoted on the revisit-read), while videos around V2–V60 that were never revisited have been evicted.
17. No new `play()` interruption warnings; no Phase 1 oscillation regressions.

## My read on this round

Codex's required fix is genuine — it patches a silent correctness bug that would only show up after an admin re-encode or a `useQuery` refetch substituted a different url under the same `item.id`. Two-line cost, zero risk. The read-promote cleanup is a standard LRU correctness item that costs three lines in the store and makes the cache behave the way the rest of the plan assumes. Both folded in; plan is ready to implement.
