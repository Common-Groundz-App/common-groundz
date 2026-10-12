# Phase 3 — Show review videos everywhere review media appears (revised)

## Still outstanding from earlier phases (not "nothing unfinished")
- Phase 2 code is built and tested (1,026 app tests, 8/8 database checks), but its signed-in browser checks of the four pages are still open. They move to Phase 4.
- Phase 1's simultaneous-save checks stay "overlap unverified".
- "Review videos" setting stays OFF.

## Places that show review media
| Place | Current viewer |
|---|---|
| Entity page review cards | `ReviewCard` (Yelp-style grid + lightbox) |
| Entity page timeline cards (review + each update) | `TimelineReviewCard` |
| Profile / My Stuff review cards | profile `ReviewCard` (`PostMediaDisplay`) |
| Review timeline viewer (read-only part) | `ReviewTimelineViewer` (old inline form stays frozen) |
| Entity Photos tab / media gallery | `photoService` gathers review + update media |
| Covers on cards and entity pages | `reviews.image_url`, set by the server only |

## What people will see
- Ready video: plays like a home-feed video — streaming, muted autoplay in view, stops when off screen, one at a time (shared with posts), hover pre-load, shared mute, tap opens the full-screen viewer at the same second, closing returns to the same second.
- Processing:
  - Author: "Processing" placeholder in the video's own space.
  - Everyone else: the slot is not shown until it is ready (decision below).
- Failed or too long:
  - Everyone else: slot not shown, no failure details.
  - Author within the edit hour: "Couldn't process this video" + "Edit to remove or replace it".
  - Author after the hour: "Couldn't process this video" + "Delete this review/update or add a timeline update". No per-video edit offered.
- Photos look and behave exactly as today.

## Decision on hidden vs placeholder (the two reviewers disagree)
I recommend hiding processing and failed videos from other people (ChatGPT's option). Reasons: cards don't change live for viewers, so there is no on-screen layout jump; others never see unfinished or broken content; it matches "failed is hidden from others". The layout stays stable for the author, who sees the placeholder. If you prefer Codex's option (neutral placeholder for everyone), tell me and I'll switch it — it only changes one rule in the shared helper.

## Player
- `FeedVideo` is already generic: it takes `source` (`post` | `review` | `entity`) and its autoplay, mute, one-at-a-time, pause/resume memory, pre-load and lightbox handoff are not tied to posts. Audit of post-only parts:
  - View counting (`useVideoViewTracker`): the only post-specific behaviour. It stays called every time, but for reviews it is switched off by an explicit "enabled" option, so no view events are sent. Post tracking is unchanged.
  - Error-report telemetry (`maybeEmitBrokenReady`): generic, keeps working; labelled with source.
  - Resume/pause memory keys use the media id, so reviews and posts never collide.
- So no new player is extracted: reviews reuse `FeedVideo` through a thin `ReviewVideo` wrapper, posts keep their current use. If the audit during build finds any other post-only behaviour, it gets the same explicit switch and is listed in the report.

## Full-screen viewer (mixed photos and videos)
- The grid, viewer and gallery use the same filtered, ordered list, so tapping item n opens item n.
- Photo → video → photo navigation works; the video starts at the card's second; on close the card video resumes at the viewer's second; the card video is paused while the viewer is open (no double playback); mute is shared; page scroll is restored.

## Photos tab
- Ready review and timeline videos are included as videos (type, playback, source review/update kept); the poster is only the thumbnail. Videos with an empty address play from their Mux playback id.
- Processing and failed videos are never included.
- Privacy unchanged: the gallery only reads reviews the viewer may see, so Private/Circle stay protected.
- The one older stored (non-Mux) review video keeps playing as before, if it still exists.
- The tab keeps the name "Photos" for now and works as a media gallery; no rename this phase (noted for later).

## Covers
- Cards and entity pages only read `reviews.image_url`. No screen computes or writes a cover. Tests confirm a failed video's poster is never shown as a cover.

## Not touched
Posts, home feed, legacy popup and inline form, photo cleanup, notifications, server rules, Mux assets.

## Tests (run now)
- Display rules: ready / processing / failed / too long × author vs others × inside vs after the edit hour.
- Rendered components with made-up Mux items for every place in the table, plus photo-only regressions.
- Viewer: correct starting item after filtering, mixed navigation, time handoff both ways, no double playback, shared mute, scroll restore.
- Player: off-screen stop, one at a time with posts, cleanup on unmount, muted autoplay, pre-load, no view events for reviews, post view events unchanged.
- Gallery: ready-only, keeps video type/source, empty-address Mux videos, legacy stored video.
- Browser and signed-in checks are carried into Phase 4 explicitly. I report results and stop.

## Technical details
- New `src/utils/reviewMediaDisplay.ts`: `displayStateFor(item, { isOwner, canEdit })` → `show` | `owner_processing` | `owner_failed_editable` | `owner_failed_locked` | `hidden`; `visibleReviewMedia(media, ctx)` returns the filtered, ordered list used by grid, viewer and gallery. `canEdit` from `reviewEditPolicy`.
- `useVideoViewTracker`: add `enabled` option (default true); `FeedVideo` passes `enabled={source==='post'}`.
- `YelpStyleMediaPreview`: ready videos render via `ReviewVideo` (wrapping `FeedVideo`, `source='review'`); `onTap` forwards handoff to `LightboxPreview` `initialVideoState` / `onExitHandoff`.
- `ReviewCard`, `TimelineReviewCard`, profile `ReviewCard`, `ReviewTimelineViewer` display block: use `visibleReviewMedia`; keep Mux fields in the mapped items (today `ReviewCard` drops them).
- `photoService`: replace `media.url` requirement with "image with url, or playable video (`isMuxPlayable` or legacy url)"; keep `source`, review/update id.
