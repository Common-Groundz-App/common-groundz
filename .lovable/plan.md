# Tighten the post detail header (Twitter-style)

Both reviews converge on the same two safeguards, and both are right. On the heading question Codex has the stronger argument, so I'm reversing my earlier call.

## Current cause of the head room

Four layers stack: `PostView` grid `py-6` → `PostContentViewer` `py-4` / `sm:p-6` → the ghost Back button's height → `mb-4` under it. Roughly 40-64px of dead space above the post, with a text label that adds nothing.

## Header changes

`src/components/content/PostContentViewer.tsx`, detail view only:

1. Replace the `Back` text button with a compact header row: icon-only back control + bold `Post` label.
2. Back control: `ArrowLeft` at `h-5 w-5` inside an `h-10 w-10 rounded-full` ghost button, `aria-label="Back"`, `-ml-2` for optical alignment. Handler logic (`navigate(-1)` with `/home` fallback) is untouched.
3. Drop `mb-4`; header row uses `mb-1`.
4. Conditional outer wrapper padding so other consumers are unaffected:
   - detail view: `pt-1 pb-4 px-0 sm:pt-2 sm:pb-6 sm:px-6`
   - non-detail (modal/embedded): existing `py-4 px-0 sm:p-6` unchanged
5. Header row keeps `px-4 sm:px-0`.

## Heading structure — "Post" becomes the stable h1

Codex's point settles it: `PostFeedItem` only renders the title `<h3>` when `post.title` exists, so tying the `<h1>` to the title would leave image-only and body-only posts with no primary heading. Instead:

- The `Post` label in the header row is the page `<h1>` — always present, one per page, styled `text-lg font-bold` (no visual difference from a bold span).
- In `src/components/feed/PostFeedItem.tsx`, the post title renders as `<h2>` when `isDetailView` is true and stays `<h3>` in the feed. Identical classes, so no visual change, and the title stays subordinate to the page heading.
- No fallback/hidden heading is needed since `Post` is unconditional.
- SEO is unaffected: `PostView` already drives `<title>`, description, and canonical from the post title via `SEOHead`.

## Desktop sidebar — measure, don't guess

Dropping the sidebar to `top-16` was speculative and Codex's arithmetic suggests it would overshoot: grid `py-6` (24px) + viewer `sm:pt-2` (8px) + 40px header + `mb-1` (4px) puts the post start near 76px, so the existing `sticky top-20` (80px) is probably already the right value.

So: keep `src/components/content/PostDetailSidebar.tsx` at `sticky top-20` (skeleton line 389 and loaded state line 435) as the starting point, then take a desktop screenshot after the header lands and compare the author card's top edge with the post's start. Only if it visibly drifts do I adjust — applying the same value to both states. The sidebar is `hidden xl:block`, so mobile is untouched either way.

## Explicitly not changing

Post fetch logic, comments, routing, feed post layout, post card width, mobile edge-to-edge behavior, and modal/non-detail viewer spacing.

## Verification

- Desktop: reduced headroom; author/entity card top edge aligned with post start (screenshot-checked, both loading and loaded).
- Mobile (~390px): tight spacing under the app header, back icon aligned with card content, ~40px tap target, post width unchanged and edge-to-edge.
- Guest and authenticated detail layouts (both render this viewer).
- Feed page visually identical; exactly one `<h1>` on the detail page for a post with a title, without a title, and image-only.
