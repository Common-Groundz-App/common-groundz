# Image-fallback project: final check and close-out

## What I checked
- **Step 4 is done.** "Learn HANA in 1 Day" is still marked deleted and no longer has a photo link. No entity, live or deleted, has a stock photo link (0 of 354).
- **Step 5 is done.** The picture picker is unchanged, as decided. The final inventory and the Step 4 record both exist.
- **No stock-photo leftovers.** All old stock-photo helpers are gone. The only stock links still in the code are the planned exceptions: the old-placeholder safety list, the default profile cover, the location photo, the founder photo in reviews, the review avatar default, and two allowed-address lists (the image proxy, and the relay check in the image component). None of these fills in a missing entity picture.
- The app builds cleanly.

## Leftover found (paperwork only)
The task list still shows three old lines as unfinished, even though that work is done:
- "Group 6B — retire entity page v1/v2/v3" (done in 6B)
- "Post-group cleanup — ImageWithFallback…final inventory audit" (done in Steps 1–5)
- "Post-6 cleanup (…)" (done in Steps 1–5)

## Change
Tick those three lines in the task list and add a one-line note that the image-fallback project is closed. Nothing else changes: no code, screens or data.

## Still open (not part of this project)
- The book-with-no-cover search case works in code but has never been tested live.
- Unrelated items already in the task list: advisory-lock tests, the optional wizard consolidation, and fixing old unlinked reviews.
