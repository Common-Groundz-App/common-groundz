# Single-Active Feed Video — Phase 1 (v4, ready to build)

Builds **Phase 1 only**. Phases 2 and 3 deferred. Incorporates v3 plus four refinements from latest review.

---

## Core principle
**Manager selects `activeId`. FeedVideo executes `play()`/`pause()`.**
Exactly one place owns playback transitions for feed videos.

---

## Refinement A — Resolve duplicate playback ownership (critical)

`src/hooks/useVideoAutoplay.ts` currently runs its own `IntersectionObserver` and calls `el.play()` / `el.pause()` internally. If left active alongside the new manager-driven effect, the two will fight (interrupted-play warnings, wrong video playing).

Fix:
- **Extract** the existing suppression rules (`shouldSuppressAutoplay`) into an exported helper from the same file (it already exists locally — just export it, no behavior change).
- In `FeedVideo`, **stop using `useVideoAutoplay` for feed cards** (or pass `enabled: false`). Replace its role with:
  ```ts
  const suppressed = shouldSuppressAutoplay();
  const { isActive, registerEl } = useFeedVideoSlot(stableId);
  const canAutoplay = isActive && !suppressed && !document.hidden;
  ```
- The new effect in `FeedVideo` is now the **sole owner** of feed-card `play()`/`pause()` transitions.
- `useVideoAutoplay` itself is **not deleted** — other call sites (if any) keep working unchanged. We only stop relying on it inside `FeedVideo`.

---

## Refinement B — Oversized video handling

Tall portrait videos (or cards) on small viewports may never reach `ratio >= 0.6`.

Use an **effective visibility score**:
```text
maxPossibleRatio = min(1, viewportHeight / elementHeight)
effectiveRatio   = rawIntersectionRatio / maxPossibleRatio   // clamped [0, 1]
```
Eligibility uses `effectiveRatio >= 0.6`; hysteresis uses `effectiveRatio >= 0.35`; switch margin `0.20` also compares effective ratios. Center-distance tiebreak unchanged.

This keeps normal cards behaving identically (`maxPossibleRatio ≈ 1`) while making oversized ones eligible when they're the dominant on-screen item.

---

## Refinement C — Explicit `visibilitychange` in the manager

The manager itself subscribes to `document.visibilitychange`:
- On `hidden`: set `activeId = null` synchronously.
- On `visible`: recompute after a short settle (one rAF + 50ms).

Does not depend on a scroll/IO event firing to pause when the tab is backgrounded.

---

## Refinement D — Swallow expected play-promise rejections

In `FeedVideo`'s play call:
```ts
el.play()?.catch((err) => {
  if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') return;
  // optionally log unexpected errors via existing logger
});
```
Keeps console clean during rapid scroll / lightbox transitions without hiding real errors.

---

## Manager API (unchanged from v3)

`src/hooks/useFeedVideoManager.tsx` exports:
- `<FeedVideoManagerProvider>` — one per visible page area
- `useFeedVideoSlot(stableId)` → `{ isActive, registerEl }`
- `useFeedVideoManagerControls()` → `{ setLightboxOpen }`

Manager state (Phase 1 only):
```text
Map<id, { el: HTMLVideoElement; rawRatio: number; effectiveRatio: number; centerDistance: number }>
activeId: string | null
lightboxOpen: boolean
debounceTimer
```

Selection:
- Eligible: `effectiveRatio >= 0.6` AND `!lightboxOpen` AND `!document.hidden`.
- Pick highest `effectiveRatio`; tiebreak by smallest center distance.
- Hysteresis: active stays while `effectiveRatio >= 0.35`. Challenger must beat by `>= 0.20`.
- Normal scroll: 200ms debounce. Lightbox open: synchronous (no debounce).

Observation:
- One `IntersectionObserver` per provider, thresholds `[0, 0.35, 0.6, 1]`.
- rAF-throttled scroll + resize listeners while ≥1 video registered.
- Recompute uses fresh `getBoundingClientRect()` (avoids stale IO ratios).

Stable IDs: `media.id` preferred, fallback `${postId}:${mediaIndex}`. Never raw index.

---

## FeedVideo integration

```ts
const { isActive, registerEl } = useFeedVideoSlot(stableId);
const suppressed = shouldSuppressAutoplay();

useEffect(() => registerEl(videoRef.current), [registerEl]);

useEffect(() => {
  const el = videoRef.current;
  if (!el) return;
  const canAutoplay = isActive && !suppressed && !document.hidden;
  if (canAutoplay) {
    el.muted = readGlobalVideoMuted(); // existing global mute, unchanged
    el.play()?.catch(safeIgnore);
  } else {
    if (!el.paused) el.pause();
    // DOM-safety mute for non-active only
    if (!isActive) el.muted = true;
  }
}, [isActive, suppressed]);
```

Rules preserved:
- Existing tap/play/pause/scrub/handoff code untouched.
- `setGlobalVideoMuted` is **never called from the manager**.
- Active video reads global mute via existing `useVideoMute`.
- DOM-mute on non-active is local only; does not change persisted preference.

---

## Lightbox handling

- `PostMediaDisplay` calls `setLightboxOpen(true)` via `useFeedVideoManagerControls()` synchronously when opening; manager clears `activeId` in the same tick.
- On close: `setLightboxOpen(false)`, recompute after settle.
- Existing reverse-handoff in `PostMediaDisplay` / `LightboxPreview` untouched.

---

## Provider wiring (one shared provider per visible page area)

Wrap each feed surface — but **never two simultaneously visible providers on the same page**:
- `/home` → `src/pages/Feed.tsx`
- Profile feed → `src/pages/Profile.tsx`
- EntityPosts feed
- `PostView` → main post + related list share **one** provider at the page root

---

## Out of scope (Phase 1)
Saved-time/resume, LRU, ended-video logic, central manual-pause, preload changes, captions/a11y, Mux/HLS/upload/composer/DB/lightbox-quality changes, global cross-page audio arbiter.

---

## Phase 1 success criteria
1. Two videos visible → only the dominant one plays.
2. Oversized portrait video centered in small viewport → still becomes active.
3. No eligible video → all paused.
4. Slow scroll → smooth active swap with hysteresis.
5. Fast scroll → no flicker, never two playing simultaneously.
6. Lightbox open → feed pauses instantly (no 200ms gap).
7. Lightbox close → existing reverse handoff still works on the originating item.
8. Tab background → feed pauses immediately (manager-level handler).
9. Tab foreground → resumes correct active video.
10. Global mute preference unchanged across all scroll/lightbox activity.
11. Save-Data / reduced-motion / 2g suppression still respected.
12. Mux and Supabase videos behave identically.
13. No new `play()` interruption warnings in the console.
14. PostView (main + related) → still only one active video across both sections.

---

## Phase 2 (later)
Bounded LRU (~200) of `{ savedTime, duration, ended, lastSeenAt }` per stable id. Seek before play. Lightbox-exit time wins.

## Phase 3 (later)
`userPaused` per id (via `isProgrammaticRef` in `FeedVideo`). Excludes video from eligibility until it fully leaves viewport or user resumes.
