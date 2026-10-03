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
- **The subject is locked in Edit.** The edit form no longer lets you pick a different subject, and the database refuses any change to who wrote it, which entity it is about, its type, or the subject name/place shown with it. Old reviews with no linked subject keep their existing behaviour.
- **Reviews:** after the hour the database blocks changes to what the author wrote — rating, text, photos, date, and the author's own answers (questionnaire and Food Tags). Other stored information (system and history details) is never changed by Edit and is not counted as author content. Automatic bookkeeping (update counts, latest rating, recommending status, trust score), moderation, and visibility (public / Circle / private, either direction) still work at any time.
- **Timeline updates:** there is currently no way for owners to change an update after posting. Add a secure owner-only edit path for the latest update only, within its hour. Its posted time, owner, and review never change; order stays the same; edits made at the same moment as an add or delete are queued safely; the review's latest rating and recommending status are recalculated once, the same way adding and undoing already do. The update is marked as edited without restarting its hour. Earlier updates stay unchangeable.
- If the hour runs out while the form is open, the form stays open with everything typed and uploaded kept, explains the window closed, and offers to add it as a timeline update (carrying over rating, text, photos, recommending). Anything the timeline form cannot take stays visible to copy.

## 4. Delete must really remove the whole thread

- Verify and, only where needed, fix complete cleanup. The database already removes timeline updates, likes, saves, and photo reports with the review. One linked table (user journeys) does not, and could block or orphan a delete — handle it explicitly. Uploaded photos/videos are not removed automatically.
- Photo/video cleanup removes only files that were uploaded by that person for that review or update and are not used anywhere else. Entity pictures, outside-website images, and shared files are never deleted. Cleanup runs after the delete succeeds and can be retried; a failed cleanup never undoes or blocks the delete. The same rule applies when an edit removes a photo.
- Both entity-page and profile Delete use one shared delete action; counts and ratings refresh immediately.
- Confirmation wording:
  - Review: "Delete your review and its complete timeline? This permanently removes the original review and all timeline updates."
  - Timeline update: "Delete this timeline update? Your original review and earlier updates will remain."

## Technical details

- Shared `ReviewOwnerMenu` used by `TimelineReviewCard`, the entity page's plain review card, and both layouts of the profile `ReviewCard`; shared `TimelineUpdateMenu` in `ReviewTimelineViewer` reusing `deleteLatestReviewUpdate`.
- Shared edit-window helper from `postEditPolicy.ts` (`created_at` based) plus `canEditReview` / `canEditTimelineUpdate`; server rule `now() < created_at + interval '1 hour'`.
- Database: review-specific BEFORE UPDATE trigger. Always rejects owner changes to `user_id`, `entity_id`, `status`, and, for linked reviews, `category`, `title`, `venue`. `status` may change only for admins/moderators (server role check) or trusted server operations. After the hour rejects changes to `rating`, `description`/`subtitle`, `media`, `image_url`, `experience_date`, and only the author keys of `metadata` (questionnaire envelope, `food_tags`); all other metadata keys must be preserved byte-for-byte by the form (audit stored keys first). Bookkeeping columns and `visibility` pass at any time. `ReviewForm` edit mode hides subject replacement.
- RPC `edit_latest_review_update` (security definer, fixed search path, owner from `auth.uid()`, latest-only by the same deterministic ordering as undo, shared advisory lock, one-hour check, allowlist of rating/comment/media/recommending only, never touches `created_at`/`user_id`/`review_id`, single recompute, typed results: ok / expired / not_latest / unauthorized / conflict). `REVOKE EXECUTE` from PUBLIC and anon; `GRANT EXECUTE` to authenticated only. Edited marker via `updated_at`.
- Delete: one atomic RPC `delete_review_thread` (same hardening: security definer, fixed search path, owner or admin from the session, revoked from PUBLIC/anon) that unlinks `user_entity_journeys` (journeys kept), deletes the review and its cascading dependents in one transaction, and returns the list of media to clean. Both entity and profile cards call it; no separate client unlink/delete calls. After commit, retryable media cleanup only for storage objects in the app's own bucket under the owner's upload path, referenced by no other review, update, post, or entity.
- Expired save: recognise the trigger/RPC result and keep the form state.
- Record the new tasks in roadmap.md and the Edit/Update/Delete definitions in docs/review-experience-contract.md.
- Checks: focused tests for menus, window boundary, subject lock, metadata preservation, confirmations, owner/non-owner; read-only production verification of the installed trigger, RPC, grants, and foreign keys. There is no separate test database, so write-path database tests will not be run against live data and will be reported as unverified. Full test suite, type check, build. Signed-in browser checks are not available for this project, so a short manual checklist will be provided. Step 3 and the paused phases remain on hold.
