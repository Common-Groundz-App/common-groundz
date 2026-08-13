# Bring the tab bar back when the keyboard is dismissed by its own button

## What's happening

The tab bar is hidden by *composer focus*, not by the keyboard. `BottomNavigation` returns `null` while any composer region is active, and a region stays active until a real `blur` event fires inside it.

- Tapping elsewhere on the page blurs the textarea -> region releases -> tab bar returns (reappear.PNG). Correct.
- Tapping iOS's "hide keyboard" key (keyboard + down-arrow, visible in click.PNG) closes the keyboard but **leaves the textarea focused**. No blur event fires, so the region stays active and the tab bar stays hidden, with the composer still docked to the bottom. That is the reported bug.

About initial.PNG (no tab bar right after opening the post): that state is not explained by anything confirmed in the code — the nav only hides while a region is active. Most likely it is the same stuck-active state left over from an earlier focus. The plan therefore adds a general safety net rather than asserting a second root cause, and step 3 verifies it on device.

## The fix

### 1. Keyboard closing releases the composer (primary fix)

`InlineCommentThread` already knows when the software keyboard is open (`useSoftwareKeyboardOpen`). Add an effect that watches for the open -> closed transition while the main composer is active and, in that case, blurs the textarea.

Blurring (rather than calling `deactivate` directly) keeps a single source of truth: the existing capture-phase `onBlurCapture` then releases the region, the composer undocks back into flow, and the tab bar reappears — exactly the same path as tapping elsewhere.

Guarded so it only runs after a genuine open->close transition (a ref holding the previous open value), so it never fires before the keyboard has ever opened, and it stays a no-op on desktop where `visualViewport` reports no keyboard.

### 2. Safety net in `ComposerFocusContext`

Add a document-level watchdog in the provider: after any `focusout`, and on `visibilitychange` / `pageshow`, check on the next frame whether `document.activeElement` is still an editable element. If it is not and the active-id set is non-empty, clear the set.

This makes a permanently hidden tab bar impossible regardless of which path stranded the state, and covers the initial.PNG symptom without guessing its cause.

### 3. Verification on device (iOS Safari)

1. Open a post -> tab bar visible, composer in flow.
2. Tap the comment box -> composer docks flush above the keyboard, tab bar hidden.
3. Tap the "hide keyboard" key -> keyboard closes, composer returns into flow, **tab bar reappears**.
4. Tap elsewhere to dismiss instead -> same result (unchanged behaviour).
5. Type, submit with the send button, keyboard stays open, tab bar stays hidden; dismiss either way -> tab bar returns.
6. Reply and edit composers -> unchanged.
7. Navigate away with the composer focused -> tab bar present on the next page.
8. Desktop above 1280px -> no change.

## Files touched

- `src/components/comments/InlineCommentThread.tsx` — keyboard-close -> blur effect.
- `src/contexts/ComposerFocusContext.tsx` — focus watchdog that clears stranded active ids.
- Tests: extend `src/contexts/ComposerFocusContext.test.tsx` (watchdog clears on focusout with a non-editable `activeElement`; no clear while focus is retained inside the region).

## Explicitly unchanged

Docking geometry and spacer, the 16px mobile font fix, comment logic, mention autocomplete, layout widths and padding, and the keyboard classifier in `src/utils/viewportKeyboard.ts`.
