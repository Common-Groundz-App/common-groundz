# Tighten the post detail header (Twitter-style)

Codex's two refinements are both right, and I'm folding them in. One place I'd diverge slightly: which element becomes the `<h1>`.

## Current cause of the head room

Four layers stack: `PostView` grid `py-6` → `PostContentViewer` `py-4` / `sm:p-6` → the ghost Back button's own height → `mb-4` under it. Roughly 40-64px of dead space above the post, with a text label that adds nothing.

## What changes

`src/components/content/PostContentViewer.tsx` (detail view only):

1. Replace the `Back` text button with a compact header row: icon-only back control (`ArrowLeft`, `aria-label="Back"`, rounded hover background) followed by a bold `Post` label.
2. **Touch target:** the arrow renders small (`h-5 w-5`) but the button keeps a ~40px hit area (`h-10 w-10 rounded-full`, `-ml-2` for optical alignment). No shrunken tap zone on mobile.
3. Drop `mb-4`; the header row uses `mb-1` instead.
4. Conditional outer wrapper padding so other consumers are untouched:
   - detail view: `pt-1 pb-4 px-0 sm:pt-2 sm:pb-6 sm:px-6`
   - non-detail (modal/embedded) use: existing `py-4 px-0 sm:p-6`
5. Header row keeps `px-4 sm:px-0` so the icon lines up with the card's internal content on mobile and desktop is unchanged.

## On semantics — one deviation from Codex

Codex asked for the `Post` label to be the `<h1>`. I'd not do that: the post's own title is already rendered as `<h3>` inside `PostFeedItem` (line 489), and the real page heading for SEO is the post title, not the chrome word "Post". Making "Post" the `<h1>` would give every post detail page an identical, contentless top heading.

So instead:

- The `Post` label is a bold non-heading element (`<span>` / `<div>`), which matches its role as page chrome.
- In `src/components/feed/PostFeedItem.tsx`, the title heading becomes `<h1>` when `isDetailView` is true and stays `<h3>` in feed context. Same classes, so zero visual change — this gives the detail page exactly one meaningful `<h1>` and keeps the feed free of stray `h1`s.

Accessibility is still covered: the back control gets `aria-label="Back"` and a proper hit area.

## Desktop sidebar alignment — verified in the same change

`src/components/content/PostDetailSidebar.tsx` currently uses `sticky top-20` in both the skeleton (line 389) and loaded state (line 435). Because the post start rises ~30-40px, `top-20` would leave the author card sitting below the post. Both are moved to `sticky top-16`, then checked side by side against the raised post start and nudged if the screenshot shows drift. The sidebar is `hidden xl:block`, so mobile is unaffected.

## Verification

- Desktop: author/entity card top edge aligns with the post's start; scroll and confirm it settles there.
- Mobile (~390px): tight spacing under the app header, back icon aligned with card content, tap target comfortable, post width unchanged and still edge-to-edge.
- Both the authenticated and guest detail layouts (both render this viewer).
- Feed page: post titles render identically, no `h1` introduced.
