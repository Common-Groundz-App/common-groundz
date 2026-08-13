# Fix iOS zoom when typing in the comment box

## What is happening

This is iOS Safari's automatic focus zoom, not a layout bug. Safari zooms the page whenever a focused text field has a font size below 16px. Once it zooms, the scale persists across navigation (feed, other pages) until the user pinches back out — exactly what the screenshots show.

The comment inputs on the post detail page use `text-sm` (14px):

- `src/components/comments/InlineCommentThread.tsx:878` — main comment composer
- `src/components/comments/InlineCommentThread.tsx:788` — inline reply composer
- The shared `Textarea` primitive (`src/components/ui/textarea.tsx`) also defaults to `text-sm`, while `Input` already guards against this with `text-base md:text-sm`.

## Changes

1. `src/components/comments/InlineCommentThread.tsx` — change `text-sm` to `text-base sm:text-sm` on the two comment textareas (main composer and reply composer). 16px on mobile stops the zoom; visual size on tablet/desktop stays exactly as today.
2. `src/components/comments/CommentItem.tsx` — apply the same `text-base sm:text-sm` to the comment edit textarea, so editing a comment on mobile does not zoom either.

No viewport meta change (`maximum-scale=1` would disable user pinch-zoom and hurt accessibility). No layout, padding, or spacing changes.

## Verification (mobile Safari)

1. Open a post detail page, tap the comment box — the page must not zoom.
2. Type, submit, then navigate back to the feed — scale unchanged.
3. Tap "Reply" on a comment and an "Edit" on your own comment — no zoom in either.
4. Desktop/tablet: comment text still renders at the current 14px size.
