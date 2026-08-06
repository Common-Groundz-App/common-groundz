# Align post detail column with the feed column

Your eye is right — they are not the same. Both pages use an identical outer grid (`xl:grid-cols-7`, `gap-4`, `px-0 sm:px-4 py-6`, left 1 / main 4 / right 2), so the grid tracks line up. Two things inside differ.

| | Feed (`/home`) | Post detail (`/post/:id`) |
|---|---|---|
| Main column | `max-w-2xl w-full mx-auto px-0 sm:px-4` | `max-w-3xl w-full mx-auto` (no padding) |
| Right sidebar sticky offset | `sticky top-4` | `sticky top-20` |

Net effect on desktop: the detail post card renders ~720px wide vs ~640px in the feed (exactly what your DevTools overlays show), and the extra width is centered in the same track, so the card's left edge sits further left. Codex's second point is also confirmed — the detail sidebar parks 80px from the top while the feed's parks 16px, so even after matching widths the two pages would still diverge as soon as you scroll. There is no fixed desktop header on either page, so the 80px offset has nothing to clear.

## Which is better

The feed is the standard to match: it is the primary repeated surface, its width is tuned for the media aspect ratios, and feed → detail should feel like opening the same card rather than resizing it. Sidebar *content* stays different (trending vs author/entity) — only grid geometry, main-column width, horizontal padding, and sticky behaviour are shared.

## Changes

1. `src/pages/PostView.tsx`, logged-in layout main column: `max-w-3xl w-full mx-auto` becomes `max-w-2xl w-full mx-auto px-0 sm:px-4` — byte-identical to the feed's main column.
2. `src/components/content/PostDetailSidebar.tsx`: `sticky top-20` becomes `sticky top-4` in both the loading skeleton (line 389) and the loaded state (line 435), matching the feed's sidebar.

Nothing else changes — grid, left rail, sidebar content, and mobile edge-to-edge behaviour stay as they are (mobile is unaffected: `px-0` below `sm`, and the sidebar is `hidden xl:block`).

## Note on the guest layout

The guest view (`PostView.tsx` line 163) is a single-column page with no sidebars, so it does not participate in the 3-column geometry. Leaving its `max-w-3xl` alone unless you want it narrowed too.

## Verification

Open the same post in the feed and on its detail page at desktop width: card left/right edges should align pixel-for-pixel. Then scroll both pages and confirm the right sidebar settles at the same distance from the top.
