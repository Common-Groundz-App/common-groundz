# Keep the bottom navigation visible when a post first opens

## Confirmed cause

The missing navigation is caused by intentional autofocus, not browser caching:

- The feed comment action navigates to `/post/:id?focus=comment`.
- `PostContentViewer` converts that query parameter into `autoFocusInput={true}`.
- Once comments finish loading, `InlineCommentThread` programmatically focuses the textarea.
- That focus activates the composer region, docks the composer, and makes `BottomNavigation` return `null` before the user taps the input.

A normal `/post/:id` route does not request this autofocus. The screenshot's docked composer is the exact state produced by the `focus=comment` route.

## Fix

1. Change the post card's comment action to open the canonical `/post/:id` detail route without `?focus=comment`.
2. Remove the now-unused automatic comment-focus chain from `PostContentViewer` and `InlineCommentThread`, including its delayed `focus()`/scroll effect, so no legacy query string can silently hide the navigation on initial load.
3. Keep manual behavior unchanged: when the user taps the comment field, it still docks above the keyboard and hides the bottom navigation; dismissing or blurring still restores the navigation.
4. Add focused regression coverage for both entry paths:
   - opening the post card;
   - opening via the comment icon.

Both must initially show the bottom navigation with the composer in normal document flow and no focused textarea.

## Files

- `src/components/feed/PostFeedItem.tsx`
- `src/components/content/PostContentViewer.tsx`
- `src/components/comments/InlineCommentThread.tsx`
- Relevant tests only

## Manual check

1. Open a post by tapping its content: bottom navigation is visible.
2. Return to the feed and open the same post via its comment icon: bottom navigation is visible and the keyboard does not open.
3. Tap the comment input: composer docks and bottom navigation hides.
4. Dismiss the keyboard using its down-arrow button: composer returns to the page and bottom navigation reappears.