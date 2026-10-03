# Step 2 — Same owner actions everywhere, and a one-hour Edit window

## Words used in this plan

- **Review** — the first thing a person writes about a subject. One person + one subject = one review.
- **Timeline update** — a later entry added to that review (the existing, working feature). Nothing new is being invented here.
- **Edit** — changing a review or a timeline update within one hour of when it was posted. Everything can be changed during that hour except the subject (you cannot move it to a different entity). After the hour, Edit disappears; you add a timeline update instead.
- **Delete** —
  - on a **review**: removes the whole thread (the review and all its timeline updates);
  - on a **timeline update**: removes only that one update (this is today's Undo, renamed).

The timeline update form has fewer fields than the review form for now. That is accepted: after the hour, some answers can only change once the later phases add them to the timeline form. No field-matrix approval gate is needed before the one-hour limit.

## 1. One shared three-dot menu on every review the person owns

- Shown on the person's own reviews on the entity page (with or without timeline updates) and on the profile (both card sizes). Never on other people's reviews. Admin moderation actions stay where they are.
- Menu items: **Add timeline update**, **Edit** (only within the hour), **Delete**.
- **Add timeline update** uses the same address handling already approved (readable address, opens once, no ID or address-bar jump). Cards that lack the address details get them through the same existing-review lookup, not a new route.
- **Delete (review)** always shows a confirmation: "This deletes your review and all its timeline updates." After the hour it also suggests adding a timeline update instead.

## 2. Timeline viewer: Undo becomes a three-dot menu

- The latest timeline update — and only that one, as today — shows a three-dot menu in place of the Undo button.
- Menu items: **Delete** (the exact existing Undo behaviour, unchanged) and **Edit** (only within one hour of that update being posted).
- Delete asks for confirmation first: "This deletes only this timeline update. Your review and earlier updates stay."
- Edit opens the existing timeline update form pre-filled with that update (rating, comment, photos, recommending choice).

## 3. One-hour Edit rule (reviews and timeline updates)

- The hour is counted from when the review or timeline update was **first posted**. Editing never restarts or extends it. Editable while less than one hour has passed; closed at exactly one hour. The server's clock decides; the screen only shows/hides Edit.
- Uses the same one-hour rule as experiences (posts); post behaviour is not changed. Admins keep their bypass, checked on the server.
- **Reviews:** the database blocks changes to what the author wrote after the hour. Automatic bookkeeping (update counts, latest rating, recommending status, trust score), moderation, and visibility (public / Circle / private, either direction) still work at any time. The subject and author can never be changed through Edit.
- **Timeline updates:** there is currently no way for owners to change an update after posting. Add a secure owner-only edit path for the latest update, limited to the hour, that recalculates the review's latest rating and recommending status the same way adding and undoing already do.
- If the hour runs out while the form is open, the form stays open with everything typed and uploaded kept, explains the window closed, and offers to add it as a timeline update instead.

## 4. Delete must really remove the whole thread

- Verify and, only where needed, fix complete cleanup. The database already removes timeline updates, likes, saves, and photo reports with the review. One linked table (user journeys) does not, and could block or orphan a delete — handle it explicitly. Uploaded photos/videos are not removed automatically; clean up media the review and its updates own when it is safe to do so.
- Both entity-page and profile Delete use one shared delete action; counts and ratings refresh immediately.

## Technical details

- Shared `ReviewOwnerMenu` used by `TimelineReviewCard`, the entity page's plain review card, and both layouts of the profile `ReviewCard`; shared `TimelineUpdateMenu` in `ReviewTimelineViewer` reusing `deleteLatestReviewUpdate`.
- Shared edit-window helper from `postEditPolicy.ts` (`created_at` based) plus `canEditReview` / `canEditTimelineUpdate`.
- Database: review-specific BEFORE UPDATE trigger that compares only author-content columns (rating, text, title fields, media, date, structured answers, metadata) and always rejects `user_id` / `entity_id` changes from owners; a security-definer, fixed-search-path RPC `edit_latest_review_update` (owner check from the session, latest-only, one-hour check, advisory lock, then recompute). `review_updates` currently has only insert and read rules for clients.
- Delete: decide the `user_entity_journeys` link behaviour (unlink, not delete the journey) and add media cleanup for review-owned files.
- Expired save: recognise the trigger's error code and keep the form state.
- Record the new tasks in roadmap.md and the Edit/Update/Delete definitions in docs/review-experience-contract.md.
- Checks: focused tests for menus, window boundary, confirmations, owner/non-owner; database checks of the trigger and RPC inside rolled-back transactions; full test suite, type check, build. Signed-in browser checks are not available for this project, so a short manual checklist will be provided. Step 3 and the paused phases remain on hold.
