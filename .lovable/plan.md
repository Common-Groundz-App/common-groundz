# Phase 3 v5.1 — SSR-safe layout effect (final)

Identical to v5 in behavior. Single additive change: wrap the `useLayoutEffect` used for pause-intent rehydration in an isomorphic helper so it degrades cleanly to `useEffect` if a server/prerender path ever exists. No other changes from v5.

## What changed vs v5

### Refinement — Isomorphic layout effect helper

**Why:** `useLayoutEffect` emits a React dev warning when executed on the server (no DOM). This project is currently Vite client-only with no SSR, so the warning never fires today. But:

- It's a one-time 3-line addition.
- Zero runtime cost in the browser (the ternary resolves at module load).
- Future-proofs against any SSG/prerender setup, static export, or test environment that runs components in Node without `window`.
- Both Codex and ChatGPT flagged it explicitly.

**Implementation:**

```ts
// At top of FeedVideo.tsx (or a small shared util if preferred — v5.1 keeps
// it inline to avoid touching unrelated files).
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

Then the v5 rehydration effect becomes:

```ts
useIsomorphicLayoutEffect(() => {
  if (pauseHydratedForIdRef.current === stableSlotId) return;
  const stored = readFeedVideoUserPaused(stableSlotId);
  setManagedUserPaused(stored, stableSlotId);
  pauseHydratedForIdRef.current = stableSlotId;
}, [stableSlotId]);
```

**Constraint (per reviewer note):** the layout effect body stays minimal — only reads the pause store, calls the unified writer, and updates the guard ref. No DOM measurement, no playback decisions, no source-attach work. The managed playback effect (which can do heavier work) remains a plain `useEffect` and early-returns until `pauseHydratedForIdRef.current === stableSlotId`.

## Everything else: unchanged from v5

All v5 design decisions carry over verbatim:

- Lazy `useState(() => readFeedVideoUserPaused(stableSlotId))` for first-mount hydration.
- `pauseHydratedForIdRef` initialized to `stableSlotId`; guard passes immediately on first mount, only gates `stableSlotId` transitions.
- Managed playback effect early-returns when `pauseHydratedForIdRef.current !== stableSlotId`.
- `setManagedUserPaused(next, id?)` is the only writer for state, `userPausedRefManaged`, and the pause store. Default `id` is `stableSlotIdRef.current`; transitional sites (source swap, rehydration, lightbox handoff) pass an explicit id.
- `systemPauseRef` / `systemPlayRef` consume-on-event pattern. Defaults to 500ms; source-attach/detach passes 1000ms; lightbox open / reverse-handoff `apply()` passes 750ms. All timers cleared on unmount.
- User-triggered `togglePlayPause` does NOT mark system. Programmatic paths do.
- Scrubber `pointerdown` calls `markSystemPause()` before `v.pause()` (preserves pre-scrub intent).
- Native `pause` listener: consumes system flag; if not system, calls `setManagedUserPaused(true)`. Native `play` listener: consumes system flag; if not system and slot is active, calls `setManagedUserPaused(false)`. Inactive-play guard from Phase 1.1 retained.
- Reverse-handoff `apply()`: `setManagedUserPaused(!wasPlaying, stableSlotId)` covers both branches.
- Source-swap effect clears pause store on prev key (id change) or current key (url-only change), both with explicit id.
- `canAutoplay = slotIsActive && ... && !userPaused`. `userPaused` is in managed effect deps.
- New file `src/hooks/useFeedVideoPauseStore.ts`: LRU `Map<string, true>`, cap 128, promote-on-read and promote-on-write, only stores `true`. Read/write/clear/__resetForTests API parallel to the resume store.
- No analytics. No new UI badge. No Phase 1 manager changes. No Phase 2 resume store behavior changes. No Mux/HLS/lightbox-quality/DB/composer/admin changes. Legacy non-managed `userPausedRef` untouched.

## Files touched

- `src/components/media/FeedVideo.tsx`
  - All v5 changes.
  - Add `useIsomorphicLayoutEffect` const at top of file.
  - Pause-rehydration effect uses `useIsomorphicLayoutEffect` instead of `useLayoutEffect` directly.
- `src/hooks/useFeedVideoPauseStore.ts` (new) — unchanged from v5.

## Verification

All 20 v5 cases unchanged. No new cases required — the helper is a transparent fallback. The reviewer-listed focus cases remain the acceptance bar:

1. Manual pause at 4s → scroll away → scroll back → stays paused at 4s.
2. Tap play → resumes from 4s.
3. System (scroll-away) pause does not set `userPaused`; on return, autoplays from saved time.
4. Lightbox close while playing → feed resumes playback.
5. Lightbox close while paused → feed stays paused at lightbox time.
6. Scrub while playing → resumes playing. Scrub while paused → stays paused.
7. Native controls pause/play update intent correctly.
8. Source swap clears pause intent.
9. Remount/reuse with stored pause intent → no one-frame autoplay flash.
10. Phase 1 single-active still works. Phase 2 saved-time resume still works.

## Out of scope (unchanged)

Analytics, UI badges, Phase 1 manager, Phase 2 LRU behavior, legacy `userPausedRef`, Mux/HLS attach internals, lightbox quality, composer, uploads, DB, RLS, edge functions.

## Summary

v5.1 = v5 + 3 lines for SSR safety. The plan is implementation-ready. No further review cycles expected.
