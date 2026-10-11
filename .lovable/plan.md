# Review video (Mux) — explanation and plan

Scope: only the new review page, the new timeline page, and their edit pages, plus every place review media is displayed. The old popups and inline forms stay frozen and photo-only.

## 1. How Mux video works today (posts only)

```text
/create picks a video
  -> app asks the server for a private Mux upload slot  (mux-create-upload)
  -> browser uploads the file straight to Mux; the "Processing" chip watches live status
  -> when the post is saved, each video slot is linked to the post  (mux-register-mappings)
  -> Mux finishes encoding and tells our server  (mux-webhook)
  -> server writes the playback id + "ready" into that slot of the post's media
  -> feed shows: poster while processing -> streaming playback when ready
```

Display pieces used on /home: autoplay when in view, hover pre-loading, adaptive streaming, "Processing" poster, error poster, lightbox that continues at the same second with the same mute state, and view tracking.

What is post-only today:
- Linking a video to its content only accepts posts (server refuses anything else).
- The "video is ready" step only updates posts.
- Edit reconciliation only exists for posts.
- Review composers hard-block video (photo-only picker and drop).

## 2. Where review media is shown

| Place | Video today |
|---|---|
| Review cards in the home feed | Lightbox plays video; small tile does not stream properly |
| Review cards on profile | Same tiles + lightbox |
| Entity page review and timeline cards | Same tiles + lightbox |
| Read-only timeline viewer | Same tiles + lightbox |
| New review / timeline pages (create + edit) | Photo-only |
| Notification thumbnails | Posts only |
| Collapsed timeline preview | Text only, no media |

So the lightbox already understands Mux; the small tiles only show the "processing" poster and do not autoplay, stream, pre-load, or hand off to the lightbox like the feed does.

## 3. Recommendation: reuse, do not copy

Do not duplicate the post code. Make the existing pipeline accept two more content kinds (review, timeline update) and reuse the same feed video player for review tiles. One system, one set of fixes. Copying would create a second video stack that drifts.

Same product rules as posts: up to 4 media items total, at most 1 video per review or update (confirm below), same size/length limits.

## 4. Steps

1. Server: allow linking uploads to reviews and timeline updates, with owner checks; "ready" step updates those rows; add edit reconciliation for both.
2. New review page + edit: allow video in the picker, show the same upload stages, poster, "Processing" chip, and compatibility hint as /create; link videos on save.
3. New timeline page + edit: same as step 2.
4. Display: replace the review tile's plain video with the feed's video player (autoplay in view, hover pre-load, streaming, lightbox resume) on feed, profile, entity page and timeline viewer cards.
5. Notifications: show video poster thumbnails for review and update notifications.
6. Removed videos on edit: unlink them and record them as "unlinked" (kept, like your earlier 3 kept videos). No automatic Mux deletion in this phase; photo cleanup stays unchanged.
7. Tests + browser checks; then your signed-in checklist.

Not touched: old popups, inline forms, rollout switch, photo cleanup rules, posts behaviour.

## Technical details

- Extend `mux-register-mappings` and `patch_content_media_from_mux` for `content_type in ('review','review_update')`; add a sync function mirroring `sync_mux_post_mappings`.
- Optional server backstop: trigger rejecting more than 1 video per row in `reviews.media` / `review_updates.media`.
- `allowVideo` on in `ReviewComposerScreen` and `TimelineComposerScreen` only; `photoOnlyReviews.test.tsx` updated so legacy forms remain photo-only.
- Reuse `FeedVideo`/`renderBranching`/`hlsAttach`/`prewarmMuxHls`/handoff inside `YelpStyleMediaPreview` (or a shared tile) instead of plain `<video src>`.
- `notificationThumbnail.ts` target types extended.
