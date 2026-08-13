# Bring the tab bar back when the keyboard is dismissed by its own button (v3)

Both reviews are right on the points that matter. Codex's two objections are accepted (the classifier's `false` is ambiguous; the global watchdog is both useless here and risky), and ChatGPT's scope point is accepted (reply and edit composers hide the nav too, so they need the same release path).

## What's happening

The tab bar is hidden by *composer focus*, not by the keyboard. `BottomNavigation` returns `null` while any composer region is active, and a region only releases on a real `blur` inside it.

- Tapping elsewhere blurs the textarea -> region releases -> tab bar returns (reappear.PNG). Correct.
- iOS's "hide keyboard" key closes the keyboard but leaves the textarea as `document.activeElement`. No blur fires, so the region stays active, the composer stays docked, and the tab bar stays hidden. That is the bug.
- initial.PNG is the same retained-focus state carried over from a previous dismissal (composer pinned to the bottom, caret still in the input, no keyboard). No second root cause is assumed.

## The fix

### 1. Make the keyboard classifier tri-state

`reduceKeyboardState` currently collapses "genuinely closed", "rotated, baseline invalidated", "pinch-zoomed", and "no baseline yet" into one `false`. Add a `keyboardStatus: 'open' | 'closed' | 'unknown'`:

- `open` — active composer, trustworthy sample, height shrunk past the threshold against the frozen baseline.
- `closed` — active composer, trustworthy sample (not zoomed, valid height, baseline present in the *same* orientation), height recovered to within the threshold of the baseline.
- `unknown` — **no active composer**, or zoomed, invalid height, no baseline, baseline invalidated by rotation, or `visualViewport` unavailable.

Inactive samples are strictly `unknown` (baseline collection still happens there), so an ordinary blur can never fabricate an `open -> closed` transition during React updates.

`keyboardOpen` stays for the docking caller but is now *derived* (`status === 'open'`) so the two can never disagree. The hook returns `{ status, open }`.

### 2. Blur only on a consecutive confirmed dismissal of the *same* session

In `InlineCommentThread`, a tracker keyed to the focused editable session — the active region id (and its element) — plus the previous confirmed status:

- Arms on `keyboardStatus === 'open'`, recording *which* editable session was active.
- Fires only when the very next usable status is `closed` **and the session identity is unchanged**.
- Disarms on `unknown`, on any session identity change (main -> reply -> edit while the keyboard stays open), when composer activity ends, on unmount, and on route change.

Eligibility is explicit and viewport-gated:

```
any thread composer active + viewport < 1280px -> observe dismissal and blur
main composer active      + viewport < 1280px -> additionally apply fixed docking
```

Above 1280px the bottom nav is already CSS-hidden, so no corrective blur runs (hardware-keyboard users are untouched).

On fire: disarm first, then resolve the target via the thread's own region container refs — not a document query:

```
activeElement is editable AND activeRegionRef.contains(activeElement) -> activeElement.blur()
```

Never blurs another thread's composer, an unrelated field, a send/cancel button, the mention popover, or anything after the region deactivated. The existing `onBlurCapture` then deactivates the region, the composer undocks, and the tab bar returns through the same centralized path as tapping elsewhere.

### 3. Cover main, reply and edit composers

The keyboard hook's `editableActive` becomes "any of this thread's regions is active" (main OR reply OR edit) instead of main-only, and the blur targets whichever composer container currently holds focus. Docking geometry stays main-composer-only and unchanged — reply and edit stay inline and only get the release-on-dismissal behaviour.

### 4. No global watchdog

Dropped. It cannot help here (the textarea stays focused) and it would misfire when focus legitimately moves inside a region to the send/cancel button or the mention picker. Route reset, unmount cleanup, and the region-scoped deferred blur containment already in `ComposerFocusContext` remain the safety net, unchanged.

## Files touched

- `src/utils/viewportKeyboard.ts` — add `keyboardStatus` (inactive => `unknown`); `keyboardOpen` derived from it.
- `src/hooks/useSoftwareKeyboardOpen.ts` — return `{ status, open }`.
- `src/hooks/useBlurComposerOnKeyboardDismiss.ts` (new) — the session-keyed dismissal tracker, extracted so it is independently testable.
- `src/components/comments/InlineCommentThread.tsx` — consume the tracker; widen `editableActive` to any region.
- Tests:
  - `src/utils/viewportKeyboard.test.ts` — closed vs unknown for inactive / rotation / zoom / no baseline / recovery.
  - `src/hooks/useSoftwareKeyboardOpen.test.tsx` — status propagation, `open` derived, no `unknown` misfire.
  - `useBlurComposerOnKeyboardDismiss` unit tests — fires on `open -> closed`; no fire on `open -> unknown -> closed`, on session identity change, or above 1280px.
  - **Component test in the existing jsdom project** — Supabase/auth/comment data mocked, asserting: focused textarea blurred on `open -> closed`, deferred `onBlurCapture` flushed via `requestAnimationFrame`, region deactivates, composer undocks, spacer removed, `BottomNavigation` renders again.
  - `ComposerFocusContext` and its tests stay as they are.

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
