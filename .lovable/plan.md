# Phase 3.1 v2.2 — Manual play promotion (final, implementation-ready)

Same behavior as v2.1. Threshold correction from reviewer feedback: `MANUAL_OVERRIDE_KEEP_RATIO` lowered below `MANUAL_ACTIVATE_MIN_RATIO` to provide stable hysteresis.

## What changed vs v2.1

### Threshold correction — hysteresis fix

Reviewer noted that `MANUAL_OVERRIDE_KEEP_RATIO = 0.15` being higher than `MANUAL_ACTIVATE_MIN_RATIO = 0.1` is backwards:

- A video at 0.12 visibility activates (>= 0.1).
- Next recompute sees 0.12 < 0.15 and immediately clears the override.
- The promoted video loses active status before the user can see it play.

**Fix:**

```
MANUAL_ACTIVATE_MIN_RATIO    = 0.1
MANUAL_OVERRIDE_KEEP_RATIO   = 0.05
```

This means: if the user can visibly click the play button (>= 0.1), we honor it generously, and keep that video active until it drops below 0.05 (nearly off-screen).

## Implementation note — fresh geometry in `requestActivate()`

Both reviewers flagged the same risk: the manager stores `raw`, `effective`, and `centerDist` on each `SlotEntry` and only updates them inside `recompute()`. If `requestActivate(id)` reads those cached values, a freshly tapped video could be rejected because the last IO tick was stale (scroll just settled, layout shifted, video just mounted, etc.).

**Required behavior:** `requestActivate(id)` must run the same per-slot geometry block already used inside `recompute()`:

```ts
const rect = el.getBoundingClientRect();
const elH = rect.height;
if (elH <= 0) return false;
const vpH = window.innerHeight || document.documentElement.clientHeight || 0;
if (vpH <= 0) return false;
const visTop = Math.max(0, rect.top);
const visBot = Math.min(vpH, rect.bottom);
const visH = Math.max(0, visBot - visTop);
const raw = visH / elH;
const maxPossible = Math.min(1, vpH / elH);
const effective = maxPossible > 0 ? Math.min(1, raw / maxPossible) : 0;
if (effective < MANUAL_ACTIVATE_MIN_RATIO) return false;
```

This block is extracted into a small internal helper (e.g. `computeSlotVisibility(el)` returning `{ raw, effective, centerDist }`) and called from BOTH `recompute()` (per slot, in the existing forEach) and `requestActivate()`. No behavior change to `recompute()` — it's a pure refactor to share the math and guarantee `requestActivate()` never reads stale state.

The freshly computed values are also written back to `slot.raw / slot.effective / slot.centerDist` inside `requestActivate()` so a subsequent `recompute()` doesn't immediately re-evaluate against pre-tap data.

### Inactive `onPlay` — confirm early return after success

Returning after a successful `requestActivate()` in the inactive `onPlay` listener so the old "inactive → immediately pause" guard doesn't fire:

```ts
// inside onPlay, when !slotIsActiveRef.current and not wasSystem:
if (requestActivate()) {
  // Successful promotion. Do NOT pause. The managed playback effect
  // re-runs after slotIsActive flips true and takes ownership.
  return;
}
// Promotion rejected (hidden tab, below threshold, lightbox open).
// Preserve single-active invariant.
markSystemPause();
v.pause();
```

## Everything else: unchanged from v2.1

All v2.1 design carries over verbatim:

- `requestActivate(id): boolean` on the manager registry, exposed via `SlotReturn.requestActivate(): boolean` bound to this slot's id.
- Rejects when: not registered, `el` missing, lightbox open, `document.hidden`, or fresh `effective < MANUAL_ACTIVATE_MIN_RATIO`.
- Constants: `MANUAL_ACTIVATE_MIN_RATIO = 0.1`, `MANUAL_OVERRIDE_KEEP_RATIO = 0.05`.
- `manualOverrideIdRef: MutableRefObject<string | null>` on the provider.
- On successful activation: clear pending `debounceRef` timeout and pending `rafRef` frame, set `manualOverrideIdRef.current = id`, call `updateActive(id)`.
- `recompute()`: if `manualOverrideIdRef.current` is set AND that slot is still registered AND its fresh effective >= `MANUAL_OVERRIDE_KEEP_RATIO` AND not lightbox/hidden, keep it active and return early. Otherwise clear the override and fall through to normal dominance.
- `setLightboxOpen(true)` clears `manualOverrideIdRef`.
- `unregisterSlot(id)` clears `manualOverrideIdRef` if it matches.
- Tab `visibilitychange` to hidden: existing behavior (clear debounce, `updateActive(null)`); also clear `manualOverrideIdRef` so it doesn't resurrect on return.
- Manual override **persists across user pause of the chosen slot** (intentional product decision, documented).
- `FeedVideo.togglePlayPause` play branch: call `requestActivate()`; on `false` return without `v.play()` and without clearing `userPaused`; on `true` proceed with existing `setManagedUserPaused(false)` + `v.play()`.
- `FeedVideo` inactive `onPlay`: if `wasSystem`, pause as before. Else call `requestActivate()`; on success return, on failure `markSystemPause()` + `v.pause()`.
- Unmanaged surfaces (no provider): `requestActivate` is `() => false`; legacy `useVideoAutoplay` path unchanged.

## Files touched

- `src/hooks/useFeedVideoManager.tsx`
  - Extract `computeSlotVisibility(el)` helper.
  - `recompute()` uses the helper inside the existing forEach (pure refactor).
  - Add `manualOverrideIdRef` and two constants.
  - Add `requestActivate(id)` on `RegistryApi` (uses helper, validates, writes back fresh values, clears pending debounce/RAF, calls `updateActive`).
  - `recompute()` honors `manualOverrideIdRef` ahead of dominance and clears it when below keep threshold.
  - `setLightboxOpen` / `unregisterSlot` / hidden `visibilitychange` clear override.
  - `SlotReturn` gains `requestActivate(): boolean` bound to this slot's id.
- `src/components/media/FeedVideo.tsx`
  - Destructure `requestActivate` from `useFeedVideoSlot`.
  - Call in `togglePlayPause` play branch (gate `play()` and `setManagedUserPaused(false)` on success).
  - Call in inactive `onPlay` for genuine native/keyboard plays (return on success, pause on failure).

## Out of scope (unchanged)

Mux/HLS, lightbox quality, Phase 2 resume store, Phase 3 pause store (except the existing `setManagedUserPaused(false)` already in the play branch), composer, uploads, DB, RLS, edge functions, UI, analytics.

## Verification cases

1. First playing, click Play on second visible → first pauses, second plays. Subsequent recompute does NOT flip back.
2. First manually paused, click Play on second → first stays paused, second plays.
3. Click Play on second, then pause second → second stays paused and active; first does NOT resume.
4. Scroll until second drops below 0.05 → override clears, dominance recompute promotes whatever is dominant.
5. Tab hidden when a stray focus/keyboard event fires `requestActivate` → returns `false`, no promotion; override also cleared on hide so it doesn't resurrect.
6. Native control play on inactive video → `requestActivate` runs with fresh geometry; success promotes, failure pauses.
7. Lightbox opens while override active → override cleared, no feed playback.
8. Unmanaged surface → `requestActivate` returns `false`; legacy autoplay unchanged.
9. Phase 2 resume on outgoing video still saves time on deactivation.
10. Phase 3 pause intent on the promoted slot survives scroll-away + return.
11. Stale-rect regression: scroll quickly so IO hasn't fired, then tap Play on a 30%-visible second video → `requestActivate` recomputes from fresh `getBoundingClientRect`, passes the 0.1 threshold, promotion succeeds.
12. Hysteresis stability: tap a video at 0.12 visibility → activates; recompute at 0.12 still >= 0.05 → override stays; only drops below 0.05 and loses override.
