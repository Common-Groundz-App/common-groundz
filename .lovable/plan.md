# Phase 1.1 — Stabilize the feed video manager (stop frame-by-frame oscillation)

## Root cause

`useFeedVideoManager.tsx` puts `activeId` inside the provider's memoized context value:

```tsx
const api = useMemo(
  () => ({ setSlotEl, unregisterSlot, activeId, setLightboxOpen }),
  [setSlotEl, unregisterSlot, activeId, setLightboxOpen]
);
```

Every `activeId` change creates a new context object. Inside `useFeedVideoSlot`:

1. New `ctx` → `registerEl` (`useCallback([ctx, id])`) becomes a new function.
2. `FeedVideo`'s registration `useEffect([managed, registerSlotEl])` cleanup runs → `registerSlotEl(null)`.
3. `useFeedVideoSlot`'s `useEffect([ctx, id])` cleanup runs → `ctx.unregisterSlot(id)`, which clears `activeId` because it matches the unregistering slot.
4. Re-register fires; next 200 ms recompute selects the same slot → `activeId` flips back → loop every ~200 ms.

Net effect: `slotIsActive` oscillates `true → false → true`, `FeedVideo`'s managed effect calls `el.play()` then `el.pause()` each cycle. Video advances ~1 frame per cycle; pause/play button label flickers.

## Fix — split context, deliver active state by per-slot subscription

Refactor `src/hooks/useFeedVideoManager.tsx`. Provider context exposes only **stable** values:

- `setSlotEl(id, el)`
- `unregisterSlot(id)`
- `setLightboxOpen(open)`
- `subscribeSlotActive(id, listener) => unsubscribe`
- `getSlotActiveSnapshot(id) => boolean`

`activeId` is **not** part of the context value. The provider never re-renders consumers on selection change.

Manager state internally still tracks a single `activeIdRef`. On change, it notifies only:
- the listener(s) registered for the **previous** active id, and
- the listener(s) registered for the **next** active id.

(Plus all listeners on `null → x` or `x → null` transitions for those two ids only.)

`useFeedVideoSlot(id)` uses `useSyncExternalStore` for a per-slot boolean:

```ts
const isActive = useSyncExternalStore(
  useCallback((cb) => ctx.subscribeSlotActive(id, cb), [ctx, id]),
  useCallback(() => ctx.getSlotActiveSnapshot(id), [ctx, id]),
  () => false
);
```

Tear-free, matches existing `useNetworkStatus.ts` pattern. Only the outgoing/incoming slots re-render on a switch.

`useFeedVideoManagerControls()` returns `{ isPresent, setLightboxOpen }` from the same stable registry context.

Consequences:
- `registerEl` is stable → `FeedVideo`'s registration effect runs only on real mount/unmount.
- `useFeedVideoSlot`'s mount effect no longer re-runs on every selection change, so the spurious `unregisterSlot → updateActive(null)` cascade is gone.
- Selection algorithm is **untouched**: thresholds 0.6 / 0.35, switch margin 0.20, 200 ms debounce, rAF + fresh `getBoundingClientRect()`, IO thresholds `[0, 0.35, 0.6, 1]`, manager-level `visibilitychange`, synchronous lightbox pause, oversized-video `effectiveRatio`.

Dev-only safety: if a `<FeedVideoManagerProvider>` mounts inside another one, `console.warn` once. Catches the "two simultaneous providers each autoplay a video" footgun without prod cost.

## Reviewer follow-ups (same pass)

### A. Reactive autoplay suppression

Add `useAutoplaySuppressed()` to `src/hooks/useVideoAutoplay.ts`:
- Returns current `shouldSuppressAutoplay()` value.
- Subscribes to `matchMedia('(prefers-reduced-motion: reduce)')` `change` events.
- Subscribes to `navigator.connection`'s `change` event when present.
- Does **not** listen to `visibilitychange` — the manager handles that, and the managed effect already reads `document.hidden`.

`shouldSuppressAutoplay` stays exported, no behavior change for legacy callers.

In `FeedVideo`, replace `const suppressed = shouldSuppressAutoplay();` with `const suppressed = useAutoplaySuppressed();` and include it in the managed effect's deps. Ownership of play/pause does not change.

### B. Inactive-play guard tied to the current `<video>` element

The guard must follow the element across replacement, not just `managed`. Add it in the same place where the element is registered with the manager:

```ts
const slotIsActiveRef = useRef(slotIsActive);
useEffect(() => { slotIsActiveRef.current = slotIsActive; }, [slotIsActive]);

const onVideoEl = useCallback((el: HTMLVideoElement | null) => {
  // detach from prior element
  if (prevElRef.current && prevPlayHandlerRef.current) {
    prevElRef.current.removeEventListener('play', prevPlayHandlerRef.current);
  }
  prevElRef.current = el;
  prevPlayHandlerRef.current = null;

  // existing assignments: videoRef.current = el; registerEl(el);

  if (managed && el) {
    const onPlay = () => {
      if (!slotIsActiveRef.current) {
        try { el.pause(); } catch { /* ignore */ }
      }
    };
    el.addEventListener('play', onPlay);
    prevPlayHandlerRef.current = onPlay;
  }
}, [managed, registerEl]);
```

Cleanup on unmount removes the listener via the same prev-ref pattern. Listener is attached/detached exactly when the element identity changes, never lost during a swap, never duplicated on re-render. Reads `slotIsActiveRef.current`, so it doesn't need to detach/reattach on every active flip.

### C. Idempotent play/pause — and active video must respect global mute

Mirror the existing `if (!el.paused) el.pause()` guard for play, and **do not force mute on the active branch**:

```ts
if (canAutoplay) {
  if (el.paused) {
    // Active video respects existing global mute preference.
    // setGlobalVideoMuted is never called from the manager/effect.
    el.muted = readGlobalVideoMuted();
    el.play()?.catch((err: any) => {
      if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') return;
    });
  }
} else {
  if (!el.paused) el.pause();
  // DOM safety mute for non-active only (local; does not change persisted preference).
  if (!isActive) el.muted = true;
}
```

This matches what's already specified in `.lovable/plan.md` (Phase 1 v4) — the "FeedVideo integration" snippet there already shows `el.muted = readGlobalVideoMuted()` for the active branch. The current `FeedVideo.tsx` implementation needs to be verified against this and corrected if it's force-muting.

## Out of scope (still deferred)

- Phase 2: saved playback time / resume LRU.
- Phase 3: centralized manual-pause / `userPaused` per id / promote-on-manual-play.
- No Mux/HLS, upload, composer, DB, lightbox-quality, reverse-handoff changes.

## Files touched

- `src/hooks/useFeedVideoManager.tsx` — split into stable registry context + per-slot `useSyncExternalStore` active subscription; targeted notify of only outgoing/incoming slot listeners; dev-only nested-provider warning. Public API surface (`FeedVideoManagerProvider`, `useFeedVideoSlot`, `useFeedVideoManagerControls`) unchanged for consumers.
- `src/hooks/useVideoAutoplay.ts` — add `useAutoplaySuppressed()`; keep `shouldSuppressAutoplay`.
- `src/components/media/FeedVideo.tsx` — swap to `useAutoplaySuppressed()`; move inactive-play guard into the element-registration callback so it tracks element identity; add `el.paused` guard before `play()`; ensure active branch uses `readGlobalVideoMuted()` (not forced `true`).

No changes to `Feed.tsx`, `Profile.tsx`, `UserProfile.tsx`, `PostView.tsx`, `EntityTabsContent.tsx`, `PostMediaDisplay.tsx`, lightbox code, or `useVideoMute`.

## Verification

1. `/home` with multiple visible videos → exactly one plays smoothly; no frame-by-frame.
2. Click pause on the active video → stays paused; button stays as "play"; no flicker.
3. Click play → resumes smoothly.
4. Scroll so a different video dominates → swap happens once, no flicker; only outgoing + incoming slots re-render (verify via React DevTools if needed).
5. Lightbox open → feed pauses instantly. Close → reverse handoff still works.
6. Tab background → feed pauses; foreground → correct video resumes.
7. Toggle OS reduced-motion while feed is open → autoplay stops without unmount.
8. Toggle global mute on the active video → preference persists; switching active video does not silently re-mute when user had unmuted.
9. Manually trigger play on a non-active card → it pauses immediately. Replace the `<video>` element (e.g. media source swap) → guard still works on the new element.
10. No new `play()` interruption warnings in console.
11. Profile / EntityPosts / PostView all behave the same — only one active video each.
