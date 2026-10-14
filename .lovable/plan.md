# Post video Phase 4 — stable Post media IDs

Phase 3 is complete (8/8 Phase 3 tests, 31/31 Phase 2 rerun, real Post video published). Simultaneous save-vs-catch-up and save-vs-webhook races stay recorded as unverified (single-connection test tool); they do not reopen Phase 3.

## Goal
Every photo and video in a Post keeps one permanent ID for its whole life, so removing, reordering, viewing and counting views always target the right item — never "whatever is in slot 2 now".

## Where things stand (read-only facts)
- All 81 saved Post media items already carry an `id`. Nothing needs backfilling today.
- The ID is chosen by the browser and the server doesn't check it, so it isn't guaranteed unique within a Post or unchanged across edits.
- Mux links still point at a slot number (`media_index`). Phase 3 keeps them correct on every save, but the slot number is the link's only anchor.

## What we would build
1. **Server owns the ID rule (database).** On every Post save:
   - A new item with no ID or an invalid ID gets a fresh server-made ID.
   - An item that already exists keeps its saved ID, matched by Mux upload ID for Mux videos and by stored file address for photos and old stored videos. A changed or forged ID on an existing item is put back to the saved value.
   - Two items with the same ID in one Post are refused.
   - Unchanged historical items stay byte-identical. Grandfathered and stuck historical Posts (including the two named ones) are never rewritten or relinked.
2. **Composer uses the ID, not the position.** The Post create/edit composer uses the media ID for list keys, the X button, reorder and readback after save. Ready-before-publish work stays as already approved; `/create` entry and flow stay unchanged.
3. **Display and viewer.** Feed card, Post detail and the full-screen viewer key items by ID, so a removed neighbour can't make the wrong video play or show the wrong "Video unavailable" tile.
4. **Mux link keeps the ID too (optional, recommended).** Store the media ID on the Post's Mux link alongside the slot number. The webhook patch then confirms ID plus upload ID before patching. Slot-number behavior and the Phase 3 lock order stay exactly as they are.
5. **Post video view tracking.** Check whether views are recorded by slot. If so, record the media ID going forward. Old rows aren't rewritten.

## Not in scope
Reviews/timeline updates (they already have stable IDs), Stories, the Post-video cap, the profile video-type question, the legacy popups, Mux asset deletion, and any change to the "removed upload can't move to another Post" rule.

## Known behavior carried forward (review later, unchanged now)
A Mux upload removed from one Post cannot be added to a different Post; the save is refused. The current UI is unaffected.

## Tests (stop for a report after each step)
- **Database, rolled-back suite `post_video_phase4.sql`:**
  - A new item gets a server ID.
  - A forged or changed ID on an existing item is restored.
  - Duplicate IDs in one Post are refused.
  - Reorder and removal keep the other items' IDs.
  - Historical Posts stay byte-identical.
  - Webhook after reorder patches the right video.
  - Late webhook after removal returns `noop_removed`.
- **Reruns:** Phase 2 (31) and Phase 3 (8) suites.
- **App tests:**
  - X removes the clicked item even when it sits next to a same-type item.
  - Reorder then save keeps the IDs.
  - The viewer opens the right item after a removal.
  - Full suite plus typecheck.
- **Owner check, separately authorized:**
  - Edit a Post with a photo and a video, remove the photo, and confirm the video still plays.
  - Reorder, save, and confirm the order is kept.

## Order and approval gates
1. Read-only report: exact current ID sources in the composer, viewer and view tracking. Stop.
2. Database rule plus Phase 4 database tests (migration shown before it runs). Stop.
3. Composer and display changes plus app tests. Stop.
4. Optional link-ID step (item 4), only if approved.
5. Owner check, then close Phase 4.

## Technical notes
- The ID rule runs inside the existing `zz_posts_media_mux_before` path, before Mux truth rebuild, so `post_mux_truth_item` stays the single source for Mux fields.
- Matching existing items: `mux_upload_id` for Mux videos; storage `url` for photos and stored-file videos; position is used only as a last resort for exact duplicates of grandfathered data, which are left untouched.
- Adding a `media_id` column on `mux_upload_mappings` would be nullable, filled only for new links. Old links stay slot-only.
