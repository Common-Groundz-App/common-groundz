# Dock the comment composer to the keyboard, Facebook-style (v4)

v4 keeps v3's positioning model and replaces the two weak parts: the keyboard classifier now works from a pre-focus baseline instead of `innerHeight` math, and the test plan covers the docking behavior rather than only the focus context.

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

### 4. Safe area keyed to a baseline-relative keyboard signal

Focus alone does not prove a software keyboard is open (iPad hardware/Bluetooth keyboard, accessibility input, programmatic focus), and `innerHeight` is not a stable layout baseline — on iOS it can shrink alongside `visualViewport.height`, which would make a difference-based test report "no keyboard" and reintroduce exactly the safe-area gap we are removing. So the classifier compares against a remembered unobscured baseline instead:

```text
baseline    = max observed visualViewport.height while no keyboard is credible,
              reset on orientationchange / width change / scale change
obscured    = baseline - (visualViewport.height + visualViewport.offsetTop)
softwareKeyboardOpen = obscured > max(120, baseline * 0.15)
```

Guards:

- The hook mounts with the composer, not on docking, so a pre-focus baseline exists before the keyboard ever appears.
- `visualViewport.scale > 1.01` (pinch zoom) → not a keyboard; baseline is not updated from zoomed frames.
- Baseline resets when `visualViewport.width` or orientation changes; it never latches a stale portrait value in landscape.
- Baseline ratchets *up* freely (browser toolbar collapsing enlarges the viewport) and only down on a reset, so toolbar movement alone cannot fake a keyboard: a collapsing toolbar grows the viewport, and its ~40-60px reappearance stays under the threshold.

Behavior:

- `softwareKeyboardOpen` → no bottom safe-area padding (the keyboard already covers the home indicator).
- Focused with no software keyboard → keep the safe-area inset.

This reads the viewport only to classify, never to position. Lifecycle: synchronous initial measurement, `resize` + `scroll` on `visualViewport` plus window `resize`/`orientationchange`, one `requestAnimationFrame` coalesce, listeners removed and pending frame cancelled on cleanup, a mounted guard against stale callbacks, rounded values. Falls back to `false` (keep safe-area padding) where `visualViewport` is missing.

### 5. Spacer: measured before first docked paint, then kept in sync

- The measurement target is the composer's **visual shell** — the same element that becomes fixed, including its border and padding — not a viewport-wide outer wrapper.
- Height is captured in `useLayoutEffect` on the transition into docked state, so the state update flushes before paint and the first docked frame already has a correct spacer (no zero-height one-frame jump).
- The spacer is dimension-only: an empty `div` with `aria-hidden="true"` and a height style. No duplicated composer DOM, and exactly one textarea is ever rendered.
- A `ResizeObserver` on that shell keeps the height current as the textarea grows from one line to several; while docked the spacer holds exactly that height in flow.
- On blur the wrapper returns to flow and the spacer unmounts in the same commit, so there is no jump either way.

### 6. No automatic comment-list scrolling

Dropped. A fixed composer is already visible; "scroll the last row" is unreliable (relevance sort, replies as the final row, post-submit reload) and fights iOS's own focus scroll. The synchronized spacer handles the real concern — content being covered.

### 7. Considered and rejected: `position: sticky; bottom-0`

Simpler (stays in flow, no spacer, inherits width), but it only pins while its scroll container extends past the viewport — which fails in exactly the empty-comments case from your screenshot. Fixed + spacer it is.

## Development instrumentation

Temporary console instrumentation only during physical testing — no debug UI, no feature flag, no committed logging. Values worth reading: composer `rect.bottom`, `visualViewport.height`, `visualViewport.offsetTop`, whether the keyboard-facing edge equals `offsetTop + height`, computed page bottom padding, shell and spacer heights, `document.activeElement`, and viewport width relative to 1280px. All of it is removed before the change is considered complete.

## Technical notes

- Purely presentational: no changes to submission, mentions, auth gating, or data flow.
- `PostView.tsx`'s `pb-[calc(4rem+...)]` stays as-is; the docked bar occupies the band the hidden nav vacated.
- Guests never dock: `enabled: Boolean(user)` already blocks activation and the existing blur-and-prompt `onFocus` path is untouched.

## Files touched

- `src/contexts/ComposerFocusContext.tsx` (expose `isActive` per region)
- `src/hooks/useSoftwareKeyboardOpen.ts` (new — the one-bit classifier from §4)
- `src/components/comments/InlineCommentThread.tsx` (docked wrapper + spacer)
- `src/contexts/ComposerFocusContext.test.tsx` (cover `isActive`: active / inactive / disabled / two instances)

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
