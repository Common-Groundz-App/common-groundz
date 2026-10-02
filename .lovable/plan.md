# Review consistency fixes (Phases 1–5 on hold)

The phased plan is paused but not discarded. These three fixes come first, done one at a time. When they are finished, Phase 1 resumes and builds on top of them.

## Fix 1 — Edit a review from the entity page, within 1 hour

What happens today:
- On the entity page, a review with updates has a 3-dot menu with only Delete. A review without updates has no menu at all.
- Editing is only possible from your profile, and it has no time limit.

What changes:
- Every review you wrote shows the 3-dot menu on the entity page. Other people's reviews never show it.
- The menu has **Edit**, which only appears within 1 hour of publishing, and **Delete**, which is always there.
- After the hour, Edit disappears. You add a timeline update instead, or delete the review and write a new one.
- The same 1-hour rule applies on your profile's review cards, so both places behave the same.
- Edit opens the same review form your profile uses today.
- The database also enforces the window, the same way posts do, so an edit after the hour is rejected even if the screen is stale. Timeline updates, deleting, and admin moderation are not affected.

## Fix 2 — One review per person per subject, everywhere

What happens today:
- The entity page swaps "Write review" for "Add timeline update" when you already reviewed that subject.
- The Create → Review path from the home page has no such check, so it creates a second review.

What changes:
- In the review form, after you pick a subject you already reviewed, the form stops. It says "You've already reviewed this" and offers **Add a timeline update**, which opens the existing review's update form, or **Cancel**. It never saves a second review.
- The database gets a rule: one active review per person per subject. This is the final safeguard against a double-tap or an old tab. Old reviews with no linked subject are not affected. The duplicate check currently reads zero; it is re-run right before the rule is added, and if anything turns up I stop and show you.
- If the rule ever blocks a save, you see the same friendly message, not an error.

## Fix 3 — Review form vs timeline update form (discussion only, nothing built)

My recommendation: don't merge them into one identical form. They do different jobs.
- **The first review** captures the full picture: subject, stars, recommend, text, media, date, and the questions.
- **A timeline update** captures what changed: a new star rating, whether you still recommend it, what's different now, and new photos.

Build both from the same shared pieces, so the star picker, recommend choice, text box and media upload look and behave identically. The update also gets an optional "Update your answers" section that reuses the review's questions, pre-filled, so you can change one without retyping the others.

I'll bring a side-by-side list of what each form has today and what's missing, for us to decide on, after Fixes 1 and 2 are done.

## Order and checks
1. Fix 1, then you check it.
2. Fix 2, then you check it.
3. Fix 3 discussion, then a separate plan.

Each fix gets focused tests, the full test suite, a type check and a build check. I can't sign in automatically on this project, so I will list exactly what you should try while signed in. roadmap.md records the pause and these three fixes.

## Technical details
- Fix 1: add a `canEditReview` helper next to `postEditPolicy.ts` (same 1-hour window, admin bypass). Use it in `entity-v4/TimelineReviewCard.tsx` and in `components/ReviewCard.tsx` (add an owner-only dropdown) and `profile/reviews/ReviewCard.tsx`. Edit mounts `ReviewForm` with `isEditMode`. Add a DB trigger on `reviews` mirroring `enforce_post_edit_window`. It covers only author-authored content columns, so timeline/system columns (`has_timeline`, `timeline_count`, `latest_rating`, `is_recommended`, `status`, `ai_summary`) still update.
- Fix 2: an existing-review lookup by (user_id, entity_id) in the subject step of `ReviewForm` (create mode only), reused by `SmartComposerButton`'s flow. Index: `create unique index reviews_one_active_per_user_entity on public.reviews(user_id, entity_id) where entity_id is not null and status <> 'deleted';`. Map error 23505 to the friendly message.
