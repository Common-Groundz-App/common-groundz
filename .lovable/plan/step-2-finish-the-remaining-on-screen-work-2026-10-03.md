# Step 2 — Finish the remaining (on-screen) work

## Status check

Done:
- Database rules: one-hour Edit window, author/subject lock, automatic fields locked, owner-only edit of the latest timeline update, whole-thread delete in one step.

Not done yet (nothing on screen uses the new rules):
- Shared three-dot owner menu on reviews.
- Timeline viewer still shows the plain Undo button.
- Edit is not limited to the first hour on screen; the edit form can still try to change the subject.
- Delete still uses the old simple delete, not the whole-thread delete; no confirmation wording from the plan.
- No recovery when the hour runs out while the form is open.
- Docs and roadmap not updated.

## What will be built

1. **One shared owner menu** on your own reviews — entity page (with or without timeline updates) and profile (both card sizes): Add timeline update, Edit (only within the hour), Delete. Admin moderation items on the profile stay as they are.
2. **Timeline viewer:** Undo becomes a three-dot menu on the latest update only, with Delete (same Undo behaviour) and Edit (within that update's hour). Edit opens the existing timeline update form pre-filled.
3. **Confirmations:**
   - Review: "Delete your review and its complete timeline? This permanently removes the original review and all timeline updates." After the hour it also suggests adding a timeline update instead.
   - Timeline update: "Delete this timeline update? Your original review and earlier updates will remain."
4. **Edit form:** subject can't be changed. If the hour ends mid-edit, the form keeps everything and offers "Add as timeline update" with rating, text, photos and recommending carried over.
5. **Delete** on entity page and profile uses the one whole-thread delete. After that, your own unused photos are cleaned up, and the cleanup can be retried. Counts refresh immediately.
6. Update the review contract doc and the roadmap.

## Technical details

- New `src/utils/reviewEditPolicy.ts`: `canEditReview`, `canEditTimelineUpdate` reusing `EDIT_WINDOW_MS` from `postEditPolicy.ts`.
- New services: `deleteReviewThread(reviewId)` (RPC `delete_review_thread`, then best-effort `deleteMedia` on `mediaToClean`, `notifyReviewsChanged`), `editLatestReviewUpdate(...)` (RPC `edit_latest_review_update`, typed statuses). Map Postgres messages `review_edit_window_closed` / `review_identity_locked` to typed errors in `updateReview`.
- New `ReviewOwnerMenu` + `ConfirmDeleteDialog`; used in `TimelineReviewCard`, the entity plain review card in `ReviewsSection`, and both layouts of profile `ReviewCard`. Add timeline update reuses `findOwnReviewForEntity` canonicalPath + `openReviewUpdate` router state.
- `ReviewTimelineViewer`: replace Undo button with `TimelineUpdateMenu`; edit mode for its update form.
- `ReviewForm` edit mode: hide the subject picker; on the expired error, keep state and show the timeline-update fallback.
- Tests: policy boundary (59:59 vs 60:00), menu visibility owner/non-owner/expired, confirmation text, service status mapping. Then full suite, type check, build. Signed-in checks are not possible here, so I'll give you a short manual checklist instead.
