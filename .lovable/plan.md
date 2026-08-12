# Why the restore isn't showing up

## What I verified in the code

The revert commit (`Reverted to commit 517fa32…`) did land, and the roomier values are on disk right now:

| File | Current (after restore) | What the trim had made it |
|---|---|---|
| `src/pages/PostView.tsx` (both layouts) | `py-6` | `pt-2 pb-6 sm:py-6` |
| `src/components/feed/PostFeedItem.tsx` | `CardContent … pt-2` | `pt-0` in detail view |
| `src/components/content/PostContentViewer.tsx` | `pt-1 … sm:pt-2`, header `mb-1` | `pt-0`, header `mb-0` |

So there is no missing code — the source is already in the restored state.

## Why your browsers still look stuffed

Two separate reasons, and both are likely in play:

1. **Published site is stale.** A restore changes the preview only. `common-groundz.lovable.app` keeps serving the last published build until you publish again, so a phone or desktop browser pointed at the published URL will still show the trimmed layout.
2. **The restore was a small change.** It only put back ~16px on mobile (`pt-2` vs `pt-0` on the grid, plus `pt-1`/`mb-1` inside the viewer). On a 390px screen that reads as "basically the same", which is easy to mistake for "the restore didn't apply". The big roomy version you remember — the wide ghost **Back** text button with `mb-4` under it — was removed in an earlier, separate change that the restore did not touch.

## Proposed steps

1. Screenshot the current preview at mobile (390px) and desktop widths with Playwright, so we have a measured baseline of the actual gap above the post rather than going by feel.
2. Publish, so mobile/desktop browsers on the published URL match the preview. (Hard refresh on device after publishing.)
3. Then decide the headroom you actually want, with the compact icon + bold **Post** header kept as-is:
   - **Option A — keep as restored:** no further code change.
   - **Option B — a bit more air:** header `mb-2` and detail wrapper `pt-2 sm:pt-3`, adding roughly 8-12px above the post.
   - **Option C — back to the old roomy feel:** restore `mb-4` under the header row (this is what created most of the original gap) without bringing back the "Back" text label.

No other pages, the feed layout, or the sidebar offset change in any option.

## Verification

Compare the same post in the feed and on its detail page at ~390px and at desktop width, before and after, and confirm the published URL matches the preview once republished.
