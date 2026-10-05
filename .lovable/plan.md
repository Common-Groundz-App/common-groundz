# Step 3.0A — Fix the audit findings before 3A

Both reviewers say the same thing, and I agree: fix F1–F5 now so the new composer starts from correct behavior. F6 waits for 3B. F7 is built into 3A. Nothing from 3A–3E starts until you approve this.

## Order and decisions

1. **F3 — Timeline privacy (fix first, on its own).** A timeline update can never be seen by more people than its parent review. Replace the open read rule on timeline updates with one that uses the parent review's own read rule. That covers public, Circle-only, private, author access, status and any moderation limits, and the two rules can't drift apart. If the parent review is missing or hidden, its updates are hidden too. Every place that reads timeline updates is checked separately: direct reads, the timeline viewer, AI summaries, notifications, search, stats and database functions. Database functions that change data and check ownership themselves keep their current permission mode. Any function that returns timeline content must either follow the reader's access rules or check the parent review's visibility itself. If the full visibility rule can't be verified, I stop and report back.
2. **F2 — "Base recommendation on rating" lost when editing.** Five states stay separate and never merge into each other: Yes, Maybe, No, auto (explicitly go back to the rating) and no statement (this update says nothing). Each one saves and reloads unchanged, and the current recommendation is recalculated correctly after every edit. The existing protections all stay: owner-only, latest update only, the one-hour limit, locking against simultaneous changes, and the current permissions. No old version of the edit function is left callable.
3. **F1 — Author actions are owner-only.** This covers every author action, not only Edit: Edit, Add timeline update, and editing or deleting a timeline update. Admins viewing someone else's review don't get the author menu. Admins keep the one-hour bypass only on their own reviews. Admin delete stays a separate moderation action with its own wording and its own permission check. No broad admin edit permission is added.
4. **F4 — Old reviews with no linked subject.** Title and venue become read-only and are never sent when saving. Every other field keeps its existing rules. Visibility in particular can still be changed at any time, not only within the hour. No lifecycle rule changes.
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
- F3: deploy as its own migration. Replace the read policy on `review_updates` with `EXISTS (select 1 from public.reviews r where r.id = review_updates.review_id)`, with the outer reference fully qualified. This inherits the RLS on `reviews` and fails closed. Before writing it, read the installed `reviews` read policies so the full rule is known. Confirm there is no recursion: the `reviews` policies must not reference `review_updates`. Confirm indexes exist on `review_updates.review_id` and on the Circle lookup path. Inventory every function, view and edge function that reads `review_updates`. For each one, record its security mode and how it is authorized.
- F3 verification is recorded in two separate parts. **Definition check:** the installed policy text is read back. **Behavior check:** the full access matrix (public, Circle-only, private, hidden, missing parent × owner, Circle member, unrelated user, signed out) is tested inside a transaction that is always rolled back, with role and JWT claims simulated. If the database access available to me can't run rolled-back fixtures, each behavior case is marked "manually unverified". A readback of the policy text is never treated as proof of behavior.
- F3 on screen, fail closed: when a timeline load confirms the update is unauthorized, missing, deleted or hidden, or when the person signs out or switches account, the timeline content already on screen is cleared. It is never kept or shown as "Anonymous". A temporary offline or network error keeps the current view and shows Retry. This applies during normal use, not only right after the change goes live.
- F2 verification cases: create with auto then edit only the comment, and it stays auto. Yes→auto, and older answers no longer count. Auto→yes. Yes→no statement, and it falls back to the previous effective answer. Auto with a changed rating, and the recommendation recalculates. Undo after an edit, and the previous answer is restored.
- F1 admin delete confirmation says it removes another person's content as a moderation action. It never uses "Delete your review".
- F4/F5: find every component on the real save path through inspection, not only the ones assumed so far. Stored identity values are kept exactly. The entity image never becomes review media, timeline media, an upload, cleanup-eligible or gallery content.
- F2: replace `edit_latest_review_update` in place with the same signature, and accept `auto` and null as distinct values. Query `pg_proc` for overloads, drop any obsolete ones, then re-apply the hardening: REVOKE from public and anon, GRANT to authenticated, keep the fixed search_path, and keep the auth.uid, latest-only, window and advisory-lock checks. Update `editLatestReviewUpdate` typing and how the timeline edit form loads saved values. Add round-trip tests for all five states, plus a check of the recalculated recommendation.
- F1: audit every review and timeline surface that offers author actions, not only `ReviewOwnerMenu`. Author items need `isOwner`. Admin non-owners get a separate moderation item for delete, with its own wording.
- F4/F5: changes are limited to `ReviewForm` and StepThree and the create mapping in the legacy form. This is a narrow correctness fix, approved as an exception to the freeze, and it resets the rollback baseline.
- Checks: read the installed policies and functions after each migration. Run read-only role-simulated queries (signed out, unrelated user, Circle member, owner) where possible. Run the database linter and the security scan. No test writes to production.
- Close-out: a short evidence record per finding in the design document, plus a signed-in manual checklist for you (privacy per role, each recommendation state, admin menus, legacy review edit, a new review saved without a photo).
- Additions of mine: the client cache refreshes after the privacy change so no updates stay on screen that shouldn't. The roadmap records 3.0A-1 to 3.0A-5 as separate tasks.
- Stop after 3.0A for approval.
