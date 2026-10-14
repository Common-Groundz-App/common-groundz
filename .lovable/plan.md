# Post video Phase 4 — stable Post media IDs

Phase 3 is complete (8/8 Phase 3 tests, 31/31 Phase 2 rerun, real Post video published, app suite and typecheck clean). Simultaneous save-vs-catch-up and save-vs-webhook races stay recorded as unverified (single-connection test tool); they do not reopen Phase 3.

## Goal
Every photo and video in a Post keeps one permanent ID for its whole life, so removing, viewing, counting views and Mux patching always target the right item — never "whatever is in slot 2 now". No new features: no reorder controls, and `/create` looks and works the same.

## Where things stand (to be confirmed by Step 1)
- All 81 saved Post media items carry an `id`. Not yet checked: uniqueness, format, duplicate file addresses.
- The ID is chosen by the browser; the server doesn't check it.
- Mux links point at a slot number (`media_index`). Phase 3 keeps it correct on every save, but it is still the link's only anchor.

## What we would build
1. **Server owns the ID rule (database).** On every Post save:
   - Existing items keep their saved ID. Matching: Mux videos by `mux_upload_id`; photos and old stored-file videos by their canonical owned storage object (bucket and path, ignoring signed-URL tokens, query strings and host). Raw URLs are never used as identity.
   - A valid ID sent by the composer for a brand-new item is kept, so `/create` previews and local playback are never reset. A new item with a missing or invalid ID gets a fresh server-made ID, and the composer adopts it from the save readback.
   - A changed or forged ID on a matched existing item is restored to the saved value.
   - Duplicate IDs within one Post are refused.
   - Position is never used to establish a new identity. Ambiguous historical data (same file twice, duplicate or missing IDs) stays byte-identical and grandfathered. An edit that would require guessing identity for those items is refused rather than resolved by slot.
   - Unchanged historical items, grandfathered Posts and the two named stuck Posts are never rewritten or relinked.
2. **Mux links store the media ID (required).**
   - New Post Mux links record post, `mux_upload_id`, `media_id` and the current `media_index`.
   - Webhook, catch-up and legacy linking patch only when both `media_id` and `mux_upload_id` match the Post item. `media_index` is only the current location.
   - Old links stay `media_id = NULL` and keep today's slot rule, which already checks the upload ID, so a stale slot can never patch another item. No backfill.
   - The Phase 3 lock order, the atomic rollback, the `app.mux_system_patch` exemption and the "removed upload can't move to another Post" rule stay exactly as they are.
3. **Composer uses the ID, not the position.** List keys, the X button and readback after save use the media ID. Ready-before-publish behavior is unchanged.
4. **Display and viewer.** Feed card, Post detail and the full-screen viewer key items by ID. Lightbox entry and exit handoff resolve by ID, so a removed neighbour can't make the wrong video play or show the wrong "Video unavailable" tile.
5. **Post video view tracking (groundwork only).** If Step 1 confirms views are keyed by file path or slot, new views also record the media ID. Historical rows, counts and de-duplication stay unchanged. Review and timeline-update view counts remain Phase 5.

## Not in scope
Reviews and timeline updates (they already have stable IDs), Stories, the Post-video cap, the profile video-type question, the legacy popups, Mux asset deletion, reorder UI, and any change to the "removed upload can't move to another Post" rule. Review videos stay OFF. No assets are touched.

## Known behavior carried forward (review later, unchanged now)
A Mux upload removed from one Post cannot be added to a different Post; the save is refused. The current UI is unaffected.

## Step 1 — read-only audit (the only step approved next)
Report, with file and line evidence and read-only queries:
- How Post media IDs are created today: composer, upload hooks, edit load, and any server or Edge Function that writes `posts.media`.
- Where composer removal and readback use ID or position.
- Feed, Post detail, collage and lightbox keys and handoff (index vs ID).
- What video view tracking stores: media path, playback ID, URL or index, plus the current `media_views` columns and de-duplication key.
- Every consumer of `mux_upload_mappings.media_index`: database functions and the `mux-register-mappings` and `mux-sync-post-mappings` Edge Functions.
- Data checks on all Posts, live and deleted:
  - duplicate IDs within a Post;
  - non-UUID or empty IDs;
  - the same storage object twice in one Post;
  - signed or tokenised URLs;
  - photos or videos whose storage object cannot be resolved;
  - Mux items whose saved link slot disagrees with their position.
- Edge cases:
  - Posts where `is_deleted` media items sit in the array;
  - old browser tabs that send items without IDs.

Then deliver the exact migration SQL and the app change list for review. Nothing runs before approval.

## Later steps (each stops for a report)
2. Database rule plus the link `media_id` column and patch checks, with the `post_video_phase4.sql` rolled-back suite; Phase 2 (31) and Phase 3 (8) reruns.
3. Composer, display and viewer changes, plus app tests.
4. View-tracking groundwork, if Step 1 shows it is needed.
5. Owner check: edit a Post with a photo and a video, remove the photo, and confirm the right video still plays and stays linked. Then close Phase 4.

## Tests planned
- **Database:**
  - New item gets a server ID.
  - Valid client ID on a new item is kept.
  - Forged ID on an existing item is restored.
  - Duplicate IDs are refused.
  - Signed-URL variants of the same file keep one ID.
  - Ambiguous historical Post stays byte-identical, and an identity-guessing edit on it is refused.
  - A database-level reorder or removal keeps every ID.
  - New link stores `media_id`.
  - Webhook after a position change patches the right item.
  - A mismatched `media_id` or upload ID is not patched.
  - Old NULL-`media_id` link still patches as before.
  - Late webhook after removal returns `noop_removed`.
  - Lock order unchanged.
- **App:**
  - X removes the clicked item when it sits next to a same-type item.
  - A generated ID is adopted after save without resetting the local preview.
  - Lightbox opens and resumes the right item after a removal.
  - Full suite plus typecheck.

## Technical notes
- The ID rule runs in the existing `zz_posts_media_mux_before` path, before the Mux truth rebuild, so `post_mux_truth_item` stays the single source of Mux fields.
- The canonical storage object comes from a server helper mirroring `extractMediaPath`, applied only to the project's own storage. Other hosts can't be matched safely, so they are treated as ambiguous and grandfathered.
- `mux_upload_mappings.media_id` is nullable, set only for new links. `sync_mux_post_mappings_core` writes it, and `patch_content_media_from_mux` checks it when present.
