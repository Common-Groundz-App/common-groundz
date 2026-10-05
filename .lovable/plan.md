# Step 3.0A — Fix the audit findings before 3A

Both reviewers say the same thing, and I agree: fix F1–F5 now so the new composer starts from correct behavior. F6 waits for 3B. F7 is built into 3A. Nothing from 3A–3E starts until you approve this.

## Order and decisions

1. **F3 — Timeline privacy (fix first).** A timeline update can never be seen by more people than its parent review. Replace the open read rule on timeline updates with one that uses the parent review's read rule, so the two rules can't drift apart. Also check every database function that reads timeline updates, so none of them gets around the rule.
2. **F2 — "Base recommendation on rating" lost when editing.** The edit action will accept `auto` the same way creating an update does. Yes, Maybe, No, auto and "no statement" will each save and reload correctly, and the current recommendation is recalculated after the edit.
3. **F1 — Admin Edit.** Edit only shows on the signed-in person's own review. Admins don't see Edit on other people's reviews, and their moderation actions stay separate. Owner-only edit permission stays as it is, with no broad admin edit permission added. An admin editing their own review can still go past the one-hour limit.
4. **F4 — Old reviews with no linked subject.** Their title and venue are shown read-only when editing, and the database lock stays as it is. Their other fields can still be edited during the hour.
5. **F5 — Entity photo saved as review media.** If the reviewer uploads nothing, the review is saved with no media and no image. The entity photo can still appear next to the review on screen. Existing reviews are not changed or deleted. I'll only count how many look like this and record the number.

## Out of scope
- F6 (composer on/off switch) waits for 3B. I'll show you the database change before applying it.
- F7 (stable upload session) goes into the new 3A composer only. The old form stays frozen.
- The headline field stays. Removing it belongs to the paused Phase 1.

## Updates to the design document
- Editing a review sends no title, venue, entity or category fields at all.
- When creating a review, its image comes only from the reviewer's own uploads.
- Editing a timeline update includes the `auto` recommendation state.
- In the normal app, only the author can edit a review.
- F1–F5 are marked fixed, with the evidence.

## Technical details
- F3: rewrite the read policy on `review_updates` using `EXISTS (select 1 from reviews r where r.id = review_id)` under security-invoker, so the parent review's own policy applies. Audit the security-definer functions that touch `review_updates` (`get_review_*`, `delete_latest_review_update`, `edit_latest_review_update`, the stats functions) for leaks.
- F2: change the domain of `p_would_recommend` in `edit_latest_review_update` to include `auto`. Update `editLatestReviewUpdate` typing and how the timeline edit form loads saved values. Add unit tests.
- F1: in `ReviewOwnerMenu`, the edit action needs `isOwner`. Admin non-owners keep only their moderation and delete options.
- F4/F5: changes are limited to `ReviewForm` and StepThree and the create mapping in the legacy form. This is a narrow correctness fix, approved as an exception to the freeze, and it resets the rollback baseline.
- Checks: read the installed policies and functions after the migration. Run read-only role-simulated queries (signed out, unrelated user, Circle member, owner) where possible. No test writes to production. Signed-in acceptance testing stays manual.
- Stop after 3.0A for approval.
