# Phase 2 v3.1 (revised²) — explicit transition + cleanup-safe finalize

Same two hardening patches on top of v3, with both Codex refinements folded in. No behavior change in any tested scenario — pure defense-in-depth.

## Patch 1 — Explicit active-to-inactive transition tracking

### Why

Current code relies on effect cleanup behavior + stable callback identity:

```ts
useEffect(() => {
  if (!managed || !slotIsActive) return;
  return () => { captureResumeFromIntent(); };
}, [managed, slotIsActive, captureResumeFromIntent]);
```

Works today, but load-bearing on dep identities. Future devs adding `stableSlotId`, `item.url`, or a non-stable callback would cause double-capture. Intent isn't visible at the call site.

### Change

Replace with explicit transition check, and explicitly bump `activationTokenRef` on the same transition so the "active → inactive invalidates in-flight resume" invariant lives at the call site (the resume-effect cleanup will also bump transitively; harmless, monotonic counter):

```ts
const prevSlotIsActiveRef = useRef(slotIsActive);
const captureResumeFromIntentRef = useRef(captureResumeFromIntent);

useEffect(() => {
  captureResumeFromIntentRef.current = captureResumeFromIntent;
}, [captureResumeFromIntent]);

useEffect(() => {
  const wasActive = prevSlotIsActiveRef.current;

  if (managed && wasActive && !slotIsActive) {
    captureResumeFromIntentRef.current();
    activationTokenRef.current++;
  }

  prevSlotIsActiveRef.current = slotIsActive;
}, [managed, slotIsActive]);
```

Using `captureResumeFromIntentRef` (not the value directly) future-proofs against the callback's deps changing later. Drop `captureResumeFromIntent` from the deps array — the ref always points at the latest version.

Add a **separate unmount-only effect** that also reads via the ref (Codex Refinement 2, Option B — robust regardless of how `captureResumeFromIntent`'s deps evolve):

```ts
useEffect(() => {
  return () => {
    if (slotIsActiveRef.current) {
      captureResumeFromIntentRef.current();
    }
  };
}, []); // unmount only
```

Then **remove the old cleanup-based deactivation effect** entirely.

Visibility-change capture and element `pause`-event capture effects are unchanged.

## Patch 2 — Resume finalizer never bumps state on cleanup (Codex Refinement 1)

### Why

`finalize()` calls `setResumeTick(t => t + 1)`. On unmount, React 18 silently no-ops the update but it's noisy in dev/strict-mode.

The originally proposed `componentMountedRef` guard has a subtle bug: React doesn't guarantee the `[]`-deps mount/unmount effect's cleanup fires *before* the resume effect's cleanup on unmount. In React 18, cleanups generally run in reverse mount order, which means `componentMountedRef.current` would still be `true` when resume cleanup runs — the guard would silently do nothing.

The robust fix is an explicit option at the call site, not a runtime flag whose value depends on effect ordering.

### Change

Make `finalize` accept a `bumpTick` option. Cleanup paths always pass `false`; async success/timeout paths (which know they're running while mounted) pass `true` (the default):

```ts
const finalize = (options?: { bumpTick?: boolean }) => {
  if (finalized) return;
  finalized = true;

  detachListeners();                    // always
  clearTimers();                        // always
  resumePendingRef.current = false;     // always — same-tick reactivation must not be blocked

  if (options?.bumpTick !== false) {
    setResumeTick((t) => t + 1);
  }
};
```

Call sites:

```ts
// seeked / loadedmetadata / timeout fallback — succeed while mounted, wake managed effect
finalize({ bumpTick: true });          // or just finalize()

// effect cleanup (dep change or unmount) — never bump
return () => {
  activationTokenRef.current++;
  finalize({ bumpTick: false });
};
```

This also correctly skips the wasted `resumeTick` bump on dep-change re-runs (the new effect run will fire naturally anyway).

**Drop `componentMountedRef`** from the plan entirely — not needed once cleanup is gated by an explicit option.

## Out of scope

- LRU store, lightbox `apply()` write, source-swap effect, pause-capture (Safeguard C), `ended` clear, managed playback effect guard, activation token usage elsewhere, Phase 1 manager, autoplay, mute.
- Phase 3 manual-pause (still deferred).
- No new files. Both patches inside `src/components/media/FeedVideo.tsx`.

## Files touched

- `src/components/media/FeedVideo.tsx`
  - Remove old cleanup-based deactivation-capture effect.
  - Add `prevSlotIsActiveRef`, `captureResumeFromIntentRef`, the ref-sync effect, and the explicit transition effect (with `activationTokenRef.current++`).
  - Add the unmount-only capture effect (uses the ref).
  - Refactor `finalize` to accept `{ bumpTick?: boolean }`; pass `false` from cleanup, default `true` elsewhere.

## Verification

Re-run all 17 v3 verification cases unchanged. Plus:

18. **Patch 1 robustness** — in a scratch branch, add `stableSlotId` and `item.url` to the new transition effect's deps. Capture must still fire exactly once per real `true → false` transition (the `wasActive && !slotIsActive` check gates it).
19. **Patch 1 token invariant** — throttle network, start a resume seek so it stays pending, scroll away before metadata loads. Confirm: in-flight resume's token check fails → skips seek; next activation reads LRU fresh and seeks correctly.
20. **Patch 1 unmount-while-active** — navigate away from the route while a slot is active at 7s. Re-enter → resumes at ~7s (unmount effect captured via ref).
21. **Patch 1 stale-closure protection** — in a scratch branch, temporarily add a non-ref render value to `captureResumeFromIntent`'s `useCallback` deps. Unmount-while-active still captures the *current* time (ref-based call site, not the closed-over old callback).
22. **Patch 2 unmount during pending resume** — start resume seek, unmount mid-seek with React dev/strict mode active. Confirm no "setState on unmounted component" devtools noise. `resumePendingRef`, timers, and listeners all cleared.
23. **Patch 2 dep-change mid-resume** — trigger source swap while resume is pending. Old effect's cleanup detaches listeners, clears timers, clears `resumePendingRef`, bumps token, and does *not* bump `resumeTick`. New effect run picks up cleanly and bumps tick on its own success path.

## My read

Both refinements upgrade us from "works because of an unwritten ordering assumption" to "works because the call sites make intent explicit." Patch 1 + Refinement 2 (callback ref) decouples the unmount capture from `captureResumeFromIntent`'s future dep evolution. Patch 2 + Refinement 1 (`{ bumpTick: false }`) decouples cleanup correctness from React's effect-cleanup ordering, which isn't a contract we should depend on. Combined cost: ~20 lines net. Recommend folding in before Phase 3.
