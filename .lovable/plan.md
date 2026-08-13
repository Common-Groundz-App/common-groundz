# Dock the comment composer to the keyboard, Facebook-style (v7)

v7 fixes the last correctness issue: v6 defined an orientation flip as the visual viewport's aspect ratio crossing between portrait and landscape, but a tall keyboard alone can shrink a 390×700 visual viewport to 390×300 — which reads as "landscape" with no rotation. That would invalidate the trustworthy baseline exactly when the keyboard opens, report `keyboardOpen: false`, keep the safe-area padding, and restore the gap this work removes. Orientation now comes from a signal that cannot move because the keyboard shrank the visual viewport. v6's earlier fix stands: the reducer takes composer activity, freezes the baseline while active, and tolerates width jitter.

The docking architecture is unchanged and approved: `fixed bottom-0` with no keyboard-height offset, one `isMainComposerDocked` boolean, 1280px breakpoint, column-constrained content, guests never dock, reply/edit inline, no automatic scrolling.

Testing infrastructure needs no work: `vitest.config.ts` already defines `node` and `dom` projects (`environment: 'jsdom'`, `plugins: [react()]`, `setupFiles: ['./src/test/setup.ts']`) and `package.json` carries Testing Library, user-event, jest-dom and jsdom. New suites only need registering in the explicit include lists.

Settled by existing evidence: in IMG_2894 `BottomNavigation` — a plain `fixed bottom-0` element — floated *directly above* the open keyboard. Fixed positioning on your device already follows the keyboard-facing viewport edge, so `bottom: keyboardInset` would double-count by a keyboard height. It is not in this plan.

## Goal

While the authenticated main comment composer is focused below 1280px, it docks flush above the keyboard with no white gap. The tab bar stays hidden (already shipped). Reply and edit composers stay inline.

## Approach

### 1. Per-region focus state from the existing context — no second state machine

`ComposerFocusContext` already owns editable-target filtering, `enabled` guest gating, deferred containment checks, unmount cleanup and instance-safe ids. `useComposerFocusRegion` gains one return field rather than a parallel local state:

- `isActive: boolean` — true when *this* region id is in the provider's active set.

`InlineCommentThread` reads `mainRegion.isActive`.

### 2. One authoritative docking condition

A single derived boolean drives everything:

```text
isMainComposerDocked = mainRegion.isActive && viewportBelowXl
```

`viewportBelowXl` comes from a `matchMedia('(max-width: 1279px)')` subscription — the same 1280px value as the nav's `xl:hidden` — via the existing `useIsMobile(1280)` hook, which already takes a breakpoint argument. Both the fixed classes *and* the spacer render off this one flag, so crossing the breakpoint can never leave a spacer without a docked bar (or vice versa). No `xl:static` class-only reset.

### 3. Dock with `fixed bottom-0`, no viewport math

While `isMainComposerDocked`:

- Wrapper: `fixed inset-x-0 bottom-0 z-50 bg-background border-t`.
- Inner content keeps `max-w-2xl mx-auto px-4` so it stays aligned with the post column instead of stretching across tablet width.
- `z-50` is the documented base tier, below dialogs (101) and the auth overlay (109). Physical testing confirms the mention popover still renders above it; if not, the popover gets a higher tier rather than the bar a lower one.

No `visualViewport` math in shipped positioning. If physical testing shows `bottom-0` sitting *behind* the keyboard on a specific browser, that comes back as a separate measured patch.

### 4. Safe area keyed to a baseline-relative keyboard signal — height only

Focus alone does not prove a software keyboard is open (iPad hardware/Bluetooth keyboard, accessibility input, programmatic focus), and `innerHeight` is not a stable layout baseline — on iOS it can shrink alongside `visualViewport.height`, which would make a difference-based test report "no keyboard" and reintroduce exactly the safe-area gap we are removing. So the classifier compares against a remembered unobscured baseline, using **height alone**:

```text
baseline  = greatest observed visualViewport.height in frames judged unobscured
            (same width, same orientation, scale ~1)
shrink    = baseline - visualViewport.height
softwareKeyboardOpen = shrink > max(120, baseline * 0.15)
```

`offsetTop` is deliberately **not** in the decision. Its coordinate meaning shifts with browser chrome, scroll position and zoom, and this plan already says that meaning must be measured on-device — so it cannot simultaneously be hard-coded into the classifier. It is read and logged during physical testing only; it enters the formula in a later patch if, and only if, device evidence requires it.

**Baseline mutation is gated on composer activity, and orientation comes from an independent signal.**

```text
interface KeyboardViewportSample {
  visualHeight: number;
  visualWidth: number;
  scale: number;
  orientation: 'portrait' | 'landscape';   // supplied by the hook, NEVER derived
  editableActive: boolean;
}
reduceKeyboardState(state, sample) → { state, keyboardOpen }
```

`orientation` is **never** computed from `visualHeight` vs `visualWidth`. The hook reads it from `window.matchMedia('(orientation: portrait)')` — a media query evaluated against the layout viewport, which the software keyboard does not resize — with `window.screen?.orientation?.type` as a cross-check where available, and `'portrait'` as the fallback when neither exists. The reducer receives it as an opaque label and compares labels only.

Rules, in order:

- `editableActive === false` and `scale <= 1.01` → trustworthy frame: establish or raise the baseline **for that orientation label** (`max(baseline, visualHeight)`). `keyboardOpen` is `false`.
- `editableActive === true` → the baseline is **frozen**. No write happens for any reason, so a keyboard-obscured sample can never become the baseline. Only the comparison runs.
- Width jitter while active → keep the frozen baseline and keep classifying. `visualWidth` is recorded for diagnostics only; it never invalidates.
- An apparent visual aspect-ratio crossing while active → **ignored entirely**. It is a keyboard artifact, not a rotation.
- A change in the independently supplied `orientation` label → invalidate the baseline for the new orientation. While `editableActive` is still `true` the result is `keyboardOpen: false` (conservative: keep safe-area padding); a new baseline is established only from the next unobscured, inactive sample.
- `scale > 1.01` (pinch zoom) → `keyboardOpen: false`, no baseline write.

State model:

```text
unfocused + scale ~1                     → establish or raise baseline for current orientation
composer becomes active                  → freeze baseline
active + credible visual-height shrink   → software keyboard open → omit safe-area padding
active + width jitter or apparent
  visual aspect-ratio crossing           → preserve baseline, keep classifying
independently confirmed rotation         → invalidate baseline
invalid baseline while active            → unknown → retain safe-area padding
unfocused unobscured sample after
  rotation                               → establish new baseline
```

**Geometry lives outside React.** A pure module (`src/utils/viewportKeyboard.ts`) owns it: `createKeyboardState()` plus `reduceKeyboardState(state, sample)`. Most classifier cases are therefore testable as plain function calls with no React and no jsdom.

**Hook contract.** The hook takes activity as an option and keeps observing before, during and after focus — only *baseline mutation* depends on `editableActive`, never event subscription:

```text
const mainRegion = useComposerFocusRegion(id, { enabled: Boolean(user) });
const softwareKeyboardOpen = useSoftwareKeyboardOpen({ editableActive: mainRegion.isActive });
const isMainComposerDocked = mainRegion.isActive && viewportBelowXl;
```

Hook lifecycle: synchronous initial sample; listeners on `visualViewport` `resize`/`scroll`, window `resize`/`orientationchange`, and the portrait media-query `change`; one `requestAnimationFrame` coalesce. `editableActive` is read from a **ref** inside the scheduled callback so a coalesced frame can never apply a stale activity value, and an `editableActive` change triggers an immediate re-sample. Listeners removed and the pending frame cancelled on cleanup, a mounted guard against stale callbacks, rounded values. Falls back to `false` where `visualViewport` is missing.

### 5. Spacer: seeded in flow, then kept in sync

- The measurement target is the composer's **visual shell** — the same element that becomes fixed, including border and padding.
- That element already carries `mainRegion.ref`. The measurement ref is **composed** with it via a callback ref that assigns both — never assigned over it, which would break focus containment.
- A `ResizeObserver` observes the shell **from mount, while it is still in flow**, so a valid height is stored before focus triggers docking. The first docked render therefore reads a real number rather than depending on a two-step render during keyboard presentation.
- Measurement semantics, stated once: seed while in flow, then **keep accepting any non-zero `ResizeObserver` measurement, docked or not**, so multi-line growth updates the spacer. Zero or missing heights are ignored (transition and unmount frames), so the last good value is retained rather than collapsing.
- A `useLayoutEffect` on the docking transition re-measures as a belt-and-braces top-up; correctness does not depend on it.
- The spacer is dimension-only: an empty `div` with `aria-hidden="true"` and a height style. No duplicated composer DOM; exactly one textarea is ever rendered.
- On blur the wrapper returns to flow and the spacer unmounts in the same commit, so there is no jump either way.

### 6. No automatic comment-list scrolling

Dropped. A fixed composer is already visible; "scroll the last row" is unreliable (relevance sort, replies as the final row, post-submit reload) and fights iOS's own focus scroll. The synchronized spacer handles the real concern — content being covered.

### 7. Considered and rejected: `position: sticky; bottom-0`

Simpler (stays in flow, no spacer, inherits width), but it only pins while its scroll container extends past the viewport — which fails in exactly the empty-comments case from your screenshot. Fixed + spacer it is.

## Development instrumentation

Temporary console instrumentation only during physical testing — no debug UI, no feature flag, no committed logging. Values worth reading: composer `rect.bottom`, `visualViewport.height`, `visualViewport.offsetTop`, whether the keyboard-facing edge equals `offsetTop + height`, computed page bottom padding, shell and spacer heights, `document.activeElement`, and viewport width relative to 1280px. All of it is removed before the change is considered complete.

## Implementation rules (explicit, per review)

- One `isMainComposerDocked` boolean drives fixed positioning, spacer rendering, shell observation and docked styling — no second derived condition.
- Region `ref` and focus handlers stay on the same element across the flow/fixed transition, so focus is never lost when the shell re-styles.
- Bottom padding is one combined value, not stacked utilities: docked with keyboard → `pb-2`; docked without a software keyboard → `pb-[calc(0.5rem+env(safe-area-inset-bottom))]`. No reliance on generated CSS order.
- The mention popover gets an explicitly higher tier than the docked bar (bar `z-50`, popover above it) rather than depending on DOM order at equal `z-50`.
- `PostView.tsx` bottom padding is left untouched unless measurement proves it causes a visible issue.

## Technical notes

- Purely presentational: no changes to submission, mentions, auth gating, or data flow.
- Guests never dock: `enabled: Boolean(user)` already blocks activation and the existing blur-and-prompt `onFocus` path is untouched.

## Files touched

- `src/contexts/ComposerFocusContext.tsx` (expose `isActive` per region)
- `src/utils/viewportKeyboard.ts` (new — pure baseline state machine from §4)
- `src/hooks/useSoftwareKeyboardOpen.ts` (new — thin subscriber feeding the state machine)
- `src/components/comments/InlineCommentThread.tsx` (docked wrapper + spacer)
- `src/utils/viewportKeyboard.test.ts` (new — added to the existing `node` project include list)
- `src/hooks/useSoftwareKeyboardOpen.test.ts` (new — subscription/lifecycle only)
- `src/components/comments/InlineCommentThread.docking.test.tsx` (new)
- `src/contexts/ComposerFocusContext.test.tsx` (add `isActive` cases)
- `vitest.config.ts` (add the new suites to the existing `node` and `dom` include lists — both projects already exist, so no infrastructure work)

## Executable coverage

`viewportKeyboard.ts` — pure, no React, no jsdom:

- Baseline seeded and raised only while `editableActive: false`; credible shrink while active → open; recovery → closed.
- No sample with `editableActive: true` ever writes the baseline — asserted directly on returned state, including a keyboard-open first-active frame.
- Width jitter while active does **not** discard the baseline; classification continues from the frozen value.
- Orientation flip invalidates the baseline; while still active the result is `keyboardOpen: false` (padding retained), and re-seeding happens only after `editableActive` returns to `false`.
- Pinch zoom (`scale > 1.01`) → not open, baseline unchanged.
- Toolbar-sized shrink under `max(120, baseline * 0.15)` → not open.
- Height-only decision: `offsetTop` is not an input to the reducer at all.
- **Full focus-to-keyboard transition** replayed as a sample sequence: pre-focus unobscured baseline, `editableActive` flips true, then the multi-frame intermediate geometry iOS emits during keyboard presentation (including a transient width jitter and interleaved scroll-driven samples), ending keyboard-settled. Asserts the baseline is byte-identical throughout and the final state is open — the exact failure mode where safe-area padding would wrongly return.

`useSoftwareKeyboardOpen` (fake `visualViewport`): initial synchronous sample, `editableActive` forwarded into every sample, a re-sample when `editableActive` changes, coalesced updates from `resize`/`scroll`/`orientationchange`, missing `visualViewport` → `false`, cleanup removes listeners and cancels the pending frame, no state set after unmount.

`InlineCommentThread` docking (jsdom, stubbed `matchMedia` and `ResizeObserver`):

- Below 1280px + active main region → fixed classes present and a spacer rendered.
- The spacer has a non-zero height on its first docked frame, sourced from the in-flow measurement taken before focus.
- `ResizeObserver` growth updates the spacer height while docked.
- A zero-height `ResizeObserver` callback does not collapse the spacer — the last non-zero value is retained.
- The composed ref is intact: focusing the textarea still activates the region (proving the measurement ref did not overwrite `mainRegion.ref`).
- Crossing 1280px while active removes fixed classes and spacer together; above `xl` neither appears.
- Keyboard open vs closed selects the correct combined bottom-padding class.
- Spacer is `aria-hidden`, contains no textarea, and only one textarea exists while docked.
- Unmount disconnects the observer.

`ComposerFocusContext`: `isActive` true for the focused region only, false for siblings, false when `enabled` is false, and independent across two mounted instances.

## Verification (physical iOS, Safari + Chrome, and iPad)

1. Tap the main comment box → composer flush above keyboard, no white gap, tab bar hidden.
2. Multi-line comment → grows upward, stays flush, spacer keeps the last comment visible.
3. Predictive-text bar on/off and keyboard switch → stays flush.
4. Submit with focus retained → stays docked, list updates above.
5. Blur → returns in flow with no jump; tab bar returns.
6. `@` mention popover → renders above the docked bar.
7. Guest tap → auth prompt, no docking, nav never hidden.
8. iPad with hardware keyboard, composer focused → safe-area padding retained, no home-indicator clash.
9. iPad ~1024px → docked bar column-aligned, not edge-to-edge.
10. Resize/rotate across 1280px while focused → docked bar and spacer appear/disappear together, no orphan gap.
11. Desktop above `xl` → no docking, no visual change.
