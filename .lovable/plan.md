# Bring the tab bar back when the keyboard is dismissed by its own button (v2)

Both reviews are right on the points that matter. Codex's two objections are accepted (the classifier's `false` is ambiguous; the global watchdog is both useless here and risky), and ChatGPT's scope point is accepted (reply and edit composers hide the nav too, so they need the same release path).

## What's happening

The tab bar is hidden by *composer focus*, not by the keyboard. `BottomNavigation` returns `null` while any composer region is active, and a region only releases on a real `blur` inside it.

- Tapping elsewhere blurs the textarea -> region releases -> tab bar returns (reappear.PNG). Correct.
- iOS's "hide keyboard" key closes the keyboard but leaves the textarea as `document.activeElement`. No blur fires, so the region stays active, the composer stays docked, and the tab bar stays hidden. That is the bug.
- initial.PNG is the same retained-focus state carried over from a previous dismissal (composer pinned to the bottom, caret still in the input, no keyboard). No second root cause is assumed.

## The fix

### 1. Make the keyboard classifier tri-state

`reduceKeyboardState` currently collapses "genuinely closed", "rotated, baseline invalidated", "pinch-zoomed", and "no baseline yet" into one `false`. Add a `keyboardStatus: 'open' | 'closed' | 'unknown'` alongside the existing boolean:

- `open` — active composer, trustworthy sample, height shrunk past the threshold against the frozen baseline.
- `closed` — active composer, trustworthy sample (not zoomed, valid height, baseline present in the *same* orientation), height recovered to within the threshold of the baseline.
- `unknown` — zoomed, invalid height, no baseline, baseline invalidated by rotation, or `visualViewport` unavailable.

`keyboardOpen` keeps its exact current meaning so docking padding is untouched. `useSoftwareKeyboardOpen` returns both values.

### 2. Blur only on a confirmed, same-session dismissal

In `InlineCommentThread`, a session-scoped tracker:

- Arms only when `keyboardStatus === 'open'` while a composer region is active.
- Fires only on `open -> closed` (never on `unknown`), and only while still armed.
- Disarms when composer activity ends, on unmount, on route change, and when docking becomes ineligible — so a stale "was open" marker can never blur a freshly focused textarea.

On fire: if `document.activeElement` is an editable element inside one of this thread's composer regions, call `.blur()` on it. Nothing else — the existing `onBlurCapture` then deactivates the region, the composer undocks, and the tab bar returns through the same centralized path as tapping elsewhere.

### 3. Cover main, reply and edit composers

The keyboard hook's `editableActive` becomes "any of this thread's regions is active" (main OR reply OR edit) instead of main-only, and the blur targets whichever composer container currently holds focus. Baseline freezing already behaves correctly for that wider input. Docking geometry stays main-composer-only and unchanged.

### 4. No global watchdog

Dropped. It cannot help here (the textarea stays focused) and it would misfire when focus legitimately moves inside a region to the send/cancel button or the mention picker. Route reset, unmount cleanup, and the region-scoped deferred blur containment already in `ComposerFocusContext` remain the safety net, unchanged.

## Files touched

- `src/utils/viewportKeyboard.ts` — add `keyboardStatus` to the reducer result (existing `keyboardOpen` semantics unchanged).
- `src/hooks/useSoftwareKeyboardOpen.ts` — return `{ open, status }`.
- `src/components/comments/InlineCommentThread.tsx` — session-scoped dismissal tracker + blur; widen `editableActive` to any region.
- Tests: extend `src/utils/viewportKeyboard.test.ts` (closed vs unknown for rotation / zoom / no baseline / recovery) and `src/hooks/useSoftwareKeyboardOpen.test.tsx` (status propagation, no `unknown` misfire). `ComposerFocusContext` and its tests stay as they are.

## Verification (physical iOS)

1. Open a post directly -> tab bar visible, composer in flow, no autofocus.
2. Open a post via the comment action (`?focus=comment`) -> autofocus is intentional; nav hidden while focused is expected.
3. Tap the comment box -> composer docks flush above the keyboard, tab bar hidden.
4. Tap the "hide keyboard" key -> keyboard closes, composer returns to flow, **tab bar reappears**.
5. Tap elsewhere instead -> same result (unchanged).
6. Submit with the send button, keyboard retained -> nav stays hidden; then keyboard-down -> nav returns.
7. Reply composer -> keyboard-down restores the nav.
8. Edit composer -> keyboard-down restores the nav.
9. Rotate the device while typing -> composer stays focused and docked, no blur.
10. Pinch-zoom while typing -> no blur.
11. Mention autocomplete: open `@`, pick a name -> no flicker, nav stays hidden.
12. Navigate away while focused -> nav visible on the next page.
13. Desktop above 1280px -> no change.

## Explicitly unchanged

Docking geometry and spacer, the 16px mobile font fix, comment submission, mentions, auth gating, layout widths and padding, and `ComposerFocusContext`.
