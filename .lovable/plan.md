# Tighten the post detail header (Twitter-style)

I agree with your read. Today the detail page opens with a `Back` ghost button that has `mb-4` under it, sitting inside a wrapper with `py-4` (mobile) / `p-6` (desktop) on top of the page grid's `py-6`. That stacks roughly 40-64px of dead space above the post, and a text label that adds nothing.

## What changes

In `src/components/content/PostContentViewer.tsx` (detail view only):

1. Replace the `Back` text button with a compact header row: a circular icon-only back button (`ArrowLeft`, `aria-label="Back"`, hover background) followed by a bold `Post` title.
2. Drop `mb-4` on the button; the header row carries a small bottom spacing instead (`mb-1`).
3. Reduce the viewer's top padding for the detail case so the header sits closer to the top: outer wrapper becomes `pt-1 pb-4 px-0 sm:pt-2 sm:pb-6 sm:px-6` in detail view, keeping the current padding for the non-detail (modal) usage.
4. Keep the header row's mobile side padding (`px-4 sm:px-0`) so the icon aligns with the card content, and keep the `-ml-2` style optical alignment via the icon button's own padding.

Net effect: ~30-40px reclaimed above the post on both mobile and desktop, and the header reads as a page title rather than a stray control.

## Notes

- Right sidebar stays at `sticky top-20`, so it keeps the vertical relationship to the post you restored earlier. If the post now starts higher than the author card, I can drop the sidebar to `top-16` as a follow-up — flagging rather than bundling it.
- The guest layout uses the same viewer, so it benefits identically.
- `Post` is the right title for now; if you later want type-aware titles ("Experience"), that's a small follow-up using `post.post_type`.

## Verification

Open a post on mobile (~390px) and desktop: the back icon + bold "Post" should sit just under the header with tight spacing, tapping the icon still goes back (with `/home` fallback), and the post card width is unchanged.
