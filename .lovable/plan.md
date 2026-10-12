# Phase 3 — Show review videos everywhere review media appears

## Phase 2 check
- Built and recorded: the four pages (Review create/edit, Timeline create/edit), "Review videos" setting (OFF), Mux-only uploads, live status chips, public-only rule, save rules, 1,026 app tests and 8/8 database checks.
- No code left unfinished. The only open items are the signed-in browser checks and turning the setting on. You chose to run those together with Phase 3 and 4 at the end.
- Phase 1's simultaneous-save checks stay "overlap unverified".

## Places that show review media today (all photo-first)
| Place | Current viewer |
|---|---|
| Entity page review cards | `ReviewCard` (Yelp-style grid + lightbox) |
| Entity page timeline cards (review + each update) | `TimelineReviewCard` |
| Profile / My Stuff review cards | profile `ReviewCard` (`PostMediaDisplay`) |
| Review timeline viewer (read-only view) | `ReviewTimelineViewer` (display part only; its old inline form stays frozen) |
| Entity Photos tab / media gallery | `photoService` gathers review + update media |
| Covers on cards and entity pages | `reviews.image_url` (server already sets Mux poster) |

## What people will see
- A review video plays like a home-feed video: streaming, autoplays muted when in view, only one plays at a time, hover pre-loads, shared mute, tap opens the full-screen viewer at the same second, closing returns to the same second.
- Processing: a neutral "preparing" poster in the same space; the author also sees "Processing".
- Failed or too long: other people see nothing for that slot and the layout closes up; the author sees "Couldn't process this video" with the hint to delete the review/update or add a new update (no editing after the hour).
- Photos look and behave exactly as today.
- The Photos tab includes ready review videos only (never processing/failed ones), using the poster as the thumbnail.

## How
- Reuse the feed's player (`FeedVideo`, its autoplay/mute/one-at-a-time manager and `LightboxPreview`), no second player. Post view counting stays with posts only; review videos pass `source="review"` and do not record post views.
- One small shared helper decides per item: show / preparing / hide-for-others / owner-error, used by every place above.
- Replace the plain `<video>` in the Yelp-style grid with the shared player for ready Mux videos.
- Videos already behind the setting: nothing new to switch; display works for any saved video (today there are none on reviews).

## Not touched
Posts, home feed, legacy popup and inline timeline form, photo cleanup, notifications, server rules, Mux assets.

## Tests
- Unit: per-item display decision (ready / processing / failed / too long, owner vs others), Photos tab filtering, no post-view tracking for reviews, photo-only regression for every place.
- Rendered component tests with made-up Mux items for each place in the table.
- Browser and signed-in checks are deferred to Phase 4 (your end-to-end run). Setting stays OFF.

## Technical details
- New `src/utils/reviewMediaDisplay.ts`: `displayStateFor(item, viewerIsOwner)` and `visibleReviewMedia(media, viewerIsOwner)`; uses `isMuxPreparing` and `mux_status`/`mux_error`.
- `YelpStyleMediaPreview`: optional `renderVideo` path via `FeedVideo` (`source='review'`, `sourceId`); `FeedVideo` skips `useVideoViewTracker` unless `source==='post'` (confirm current gate first).
- `ReviewCard`, `TimelineReviewCard`, profile `ReviewCard`, `ReviewTimelineViewer` display block: filter through `visibleReviewMedia`, pass handoff to `LightboxPreview`.
- `photoService`: include videos only when ready Mux (or legacy url), skip items lacking url but having playback id handled via poster.
