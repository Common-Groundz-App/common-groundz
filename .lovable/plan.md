# Phase 3.0 verification + Phase 3.3A plan

## Phase 3.0 is complete

- `src/utils/notificationSections.ts` and its test file exist and are registered in `vitest.config.ts`.
- `NotificationList.tsx` owns the `now` state, the local-midnight `setTimeout` re-label, and renders sticky section headers around grouped rows.
- No leftovers: nothing else in the codebase references sectioning, and the whole suite passes (184 tests, 9 files).
- Roadmap already marks 3.0 done and records the two 3.3 prerequisites (avoid `notifications.image_url`; row must stop being one big `<button>` before a Follow-back button lands).

## Next: Phase 3.3A — target thumbnails

Goal: each notification row shows a small preview of the *content it points at* (the liked post's image, the recommendation's image) on the right side, so the user knows which post it refers to without opening it.

### Behavior

- Thumbnail only for rows whose target is a post or recommendation (`entity_type` = `post` / `recommendation` with a valid UUID). Follows, system rows and comment-scoped rows show no thumbnail.
- Fixed-size 40x40 rounded slot. If media is missing, deleted, video-only-without-poster, or hidden by RLS, the slot renders nothing (no placeholder box, no letter initials) and text simply spans wider.
- Never render the actor avatar as the thumbnail — the actor avatar already sits on the left.
- Images only: for `posts.media`, take the first non-deleted item that yields an image URL; for Mux video items use the Mux poster/thumbnail via existing `muxMedia.ts` helpers; never a raw playback URL.
- Aggregated like-groups share one target, so one lookup per group.

### Data

- New hook `src/hooks/useNotificationTargets.ts`: collects distinct `(entity_type, entity_id)` pairs from the currently rendered groups, chunks ids (200 max per request), and issues at most one query per entity type:
  - `posts`: `select id, media` filtered by `id in (...)` and `is_deleted = false`.
  - `recommendations`: `select id, image_url` filtered by `id in (...)`.
- RLS stays the authorization boundary — rows the viewer can't see simply come back absent and render no thumbnail.
- Results cached with react-query keyed per entity type + id, so scrolling and polling do not refetch, and the cache is account-scoped like the other notification queries.
- Resolution logic lives in a pure module `src/utils/notificationThumbnail.ts` (`resolveTargetThumbnail(entityType, row)`), unit-tested: image item, Mux ready item, Mux preparing item, deleted media, empty media, malformed jsonb, missing row.

### UI

- `NotificationList` calls the hook once with the flat groups and passes the resolved `thumbnailUrl` down to each `NotificationRow`.
- `NotificationRow` renders the thumbnail as a non-interactive `<img aria-hidden>` inside the existing row button (no nested interactive element, so no HTML validity issue in this phase), placed where the read check currently sits; the read check moves next to the timestamp.
- External URLs route through the existing image proxy path used elsewhere for non-Supabase hosts; `loading="lazy"` and `decoding="async"`; on `onError` the slot collapses.

### Out of scope (stays for 3.3B)

Follow-back button, the row-structure refactor it requires, and any centralized follow mutation.

### Verification

- New unit tests for `notificationThumbnail.ts` plus a batching test for the id-chunking helper; full suite must stay green.
- Manual: like a post with an image, a post with a video, a text-only post, and a recommendation, then confirm the drawer shows correct previews and clean empty slots.
