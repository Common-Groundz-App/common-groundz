# Keep the bottom navigation visible when a post first opens (v2)

Both reviews are accepted. The comment icon keeps its meaning ("take me to the discussion") but never enters writing mode, and the `focus=comment` contract is retired everywhere rather than only at its main producer.

## Confirmed cause

The missing navigation is intentional autofocus, not caching or Safari:

- The feed comment action navigates to `/post/:id?focus=comment`.
- `PostContentViewer` turns that query parameter into `autoFocusInput`.
- After comments load, `InlineCommentThread` runs a delayed `textarea.focus()`.
- That focus activates the composer region, docks the composer `fixed bottom-0`, and `BottomNavigation` returns `null` — all before the user taps anything.

## Behavior after the fix

| Action | Scrolls to comments | Focuses input | Opens keyboard | Bottom nav initially |
| --- | --- | --- | --- | --- |
| Tap post body | No | No | No | Visible |
| Tap comment icon | Yes | No | No | Visible |
| Open legacy `?focus=comment` URL | No | No | No | Visible |
| Tap the comment textarea | n/a | Yes | Yes | Hidden |
| Dismiss the keyboard | n/a | No | No | Visible |

## Changes

### 1. Comment icon: navigate to the discussion, not into composition

`PostFeedItem`'s comment action opens the canonical detail route with a comments anchor (`/post/:id#comments`) instead of `?focus=comment`.

### 2. Scroll to comments without focusing anything

The comments section gets a stable `id="comments"` anchor. On the detail page, when the hash is `#comments`, scroll that section into view once after comments finish loading — no `focus()`, no keyboard.

Two ordering rules this must respect:

- `ScrollToTop` scrolls to the top on PUSH/REPLACE navigations. The comments scroll must run after that settles (post-load, in a frame/timeout) so the two don't fight.
- A `commentId` highlight scroll always wins. When `?commentId=` is present, the highlight scroll runs and the `#comments` scroll is skipped, so deep-linked comments are never overridden.

### 3. Retire the autofocus chain, on every viewport

- Remove `autoFocusInput` from `InlineCommentThread` along with its delayed `focus()` effect. Not gated by breakpoint — removed, so desktop and mobile behave identically and there is no second code path to reason about.
- Remove `autoFocusComment` and the `focus` query read from `PostContentViewer`.

### 4. Retire the legacy URL contract consistently

`normalizeInternalPath` in `src/utils/notificationDestination.ts` currently preserves `focus=comment`. Drop that preservation (and its test expectations) so the parameter is stripped like any other foreign param. Old bookmarked or shared `?focus=comment` links then degrade cleanly to the ordinary post page. `commentId` preservation is unchanged.

## Explicitly unchanged

Manual tap activating the composer region; `fixed bottom-0` docking below 1280px; nav hiding while composing; the confirmed keyboard-dismiss blur that restores the nav; reply and edit composers; spacer measurement and safe-area padding; guest auth gating; comment submission; mention autocomplete; the 16px mobile font fix; and all layout widths and padding.

## Files

- `src/components/feed/PostFeedItem.tsx`
- `src/components/content/PostContentViewer.tsx`
- `src/components/comments/InlineCommentThread.tsx`
- `src/utils/notificationDestination.ts` and `src/utils/notificationDestination.test.ts`

## Regression tests

1. Open a post by tapping its body: bottom nav visible, composer in flow, nothing focused.
2. Open a post via the comment icon: bottom nav visible, comments section scrolled into view, nothing focused.
3. Legacy `/post/:id?focus=comment`: no focus, no keyboard, nav visible.
4. `/post/:id?commentId=<uuid>`: the highlight scroll runs and is not overridden.
5. Manual tap on the comment input: composer docks, nav hides.
6. Keyboard dismissed via its down-arrow key: composer returns to flow, nav reappears.
7. `normalizeInternalPath` strips `focus=comment` while still preserving a valid `commentId`.

## Manual check on device

1. Feed to post via body tap: nav visible.
2. Feed to post via comment icon: lands on the comments section, keyboard closed, nav visible.
3. Tap the input: docks flush above the keyboard, nav hidden.
4. Keyboard down-arrow: nav returns.
5. A notification that points at a specific comment still highlights and scrolls to it.
