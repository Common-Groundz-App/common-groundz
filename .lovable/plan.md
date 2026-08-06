# Align post detail column with the feed column

Your eye is right — they are not the same. Both pages use an identical outer grid (`xl:grid-cols-7`, `gap-4`, `px-0 sm:px-4 py-6`, left 1 / main 4 / right 2), so the grid tracks line up. The difference is inside the main column.

| | Feed (`/home`) | Post detail (`/post/:id`) |
|---|---|---|
| Main column max width | `max-w-2xl` (672px) | `max-w-3xl` (768px) |
| Main column side padding | `px-0 sm:px-4` | none |

Net effect on desktop: the detail post card renders ~720px wide vs ~640px in the feed (exactly what your DevTools overlays show), and because the extra width is centered inside the same 4-column track, the card's left edge sits further left than the feed's. So the post looks bigger and shifted, and the gap to the right sidebar reads differently.

## Which is better

The feed is the one to match. It is the surface users see most, its width is tuned for the media aspect ratios, and keeping detail identical to feed is the whole point of the edge-to-edge work we just did — the card should feel like the same object, just opened.

## Change

In `src/pages/PostView.tsx`, logged-in layout, main column:

- `max-w-3xl` becomes `max-w-2xl`
- add `px-0 sm:px-4`

so it matches the feed's main column exactly. Nothing else changes — grid, sidebars, left rail, and mobile edge-to-edge behaviour stay as they are (mobile is unaffected because `px-0` applies below `sm`).

## Note on the guest layout

The guest view (line 163) uses `container max-w-3xl mx-auto` with no sidebars, so it is a single-column page and does not need to match the 3-column grid. Leaving it alone unless you want it narrowed too.

## Verification

Open the same post in the feed and on its detail page at desktop width and confirm the card's left and right edges align pixel-for-pixel between the two.
