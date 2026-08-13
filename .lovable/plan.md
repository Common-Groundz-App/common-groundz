# Hide the bottom tab bar while the comment box is focused

## What's happening

`BottomNavigation` is `fixed bottom-0`. On iOS the software keyboard shrinks the visual viewport, so anything pinned to the bottom gets pushed up and parks directly on top of the keyboard. That's why the tab bar (Home / Explore / Create / My Stuff / Profile) floats above the keyboard, squeezed against the comment row — exactly what your screenshot shows.

## How the big apps handle it

- Instagram, Twitter/X, Threads, YouTube: as soon as a text composer takes focus, the tab bar is **hidden** and only the composer row docks above the keyboard. One input surface, no competing navigation.
- Nobody keeps a 5-item tab bar visible above an open keyboard — it eats ~60px of the small remaining space and invites mis-taps that discard what you're typing.

Recommendation: hide the tab bar while a comment composer is focused, restore it on blur. This is the standard pattern and the least invasive change.

## Changes

1. `src/components/comments/InlineCommentThread.tsx` — on the main comment textarea (and the reply/edit textareas), `onFocus` dispatches a `composer-focus` window event with `{ active: true }`; `onBlur` dispatches `{ active: false }`. No change to the existing auth-gating logic inside `onFocus` (`requireAuth` stays first).
2. `src/components/navigation/BottomNavigation.tsx` — listen for that event in a `useEffect`, keep an `isComposerFocused` state, and when true render nothing (or apply `hidden`). Listener cleaned up on unmount; state resets on route change so the nav can never get stuck hidden.

Optional small polish included: after focus, `scrollIntoView({ block: 'nearest' })` on the composer row so the input sits just above the keyboard instead of half-clipped (your screenshot shows the placeholder text cut off at the bottom).

## What is not changing

- No viewport/`user-scalable` changes.
- The 16px mobile font size fix from the previous phase stays as is.
- No padding, width, comment behaviour, or mention-autocomplete changes.
- Desktop is unaffected — the tab bar is already `xl:hidden`.

## Verification

On iOS Chrome/Safari, open a post, tap the comment box: tab bar disappears, composer sits above the keyboard, text is fully visible. Dismiss the keyboard or tap elsewhere: tab bar returns. Navigate to Home mid-typing: tab bar is present and page scale is normal.
