# Review Lifecycle Consistency (Phases 1–5 paused, not discarded)

The basic rules:
- One person and one subject means one review.
- **Edit** fixes a mistake within 1 hour of publishing.
- **Add update** records a new or changed experience, at any time, and keeps the history.
- **Delete** removes the review and all its updates. It is an escape hatch, not the normal way to change your opinion.

There are three steps. Each one is built, checked, and approved by you before the next starts.

## Step 1 — No second review for the same subject

Today you can start a review from three places:
- **Entity page:** "Write review", or "Add timeline update" if you already reviewed it. This one is correct.
- **Home → Create → Review:** no check, so a second review gets created. This is the bug.
- **Your profile → Add new review:** same form, same bug.

What changes:
- In the review form, once you pick a subject you already reviewed, the form stops. It shows "You've already reviewed this" with **Add an update**, which opens that review's update form, and **Cancel**.
- A database rule allows only one active review per person per subject. This covers double-taps and old tabs. Old reviews with no linked subject are not affected. The duplicate check is re-run first; if anything turns up, I stop and show you.
- If that rule ever blocks a save, you get the same friendly message, not an error.

## Step 2 — Same review menu everywhere, plus the 1-hour edit window

What changes:
- Every review you wrote shows the 3-dot menu: on the entity page (with or without updates) and on your profile. Other people's reviews never show it.
- The menu always has **Add update** and **Delete**. **Edit** appears only during the first hour.
- One shared rule decides the time window for posts and reviews, so they can't drift apart. Admins can still edit any time.
- The database also enforces the hour, so a stale screen can't edit an old review. It only blocks your own content: rating, text, photos, date, answers and subject. Automatic changes such as update counts, latest rating and recommending status still go through, and so does moderation.
- **Who can see it** (visibility) stays changeable at any time, for privacy.
- After the hour, the Delete confirmation suggests adding an update instead, because deleting erases the history.

## Step 3 — Review form vs update form (comparison first, nothing built)

I'll bring you a side-by-side table of what the review form and the update form each have today, and what's missing from each. My starting suggestion is:
- **Shared pieces:** stars, recommend, text box and photos look and work the same in both forms.
- **Different jobs:** the update stays short ("What's changed?"), with an optional "Update your answers" section pre-filled from your review.

We decide together, and then I write a separate plan.

After Step 3, the paused phases resume.

## Checks for each step
- Focused tests, the full test suite, a type check, and the build log.
- I can't sign in automatically on this project, so I'll list exactly what you should try while signed in.
- roadmap.md records the pause and these steps.

## Technical details
- Step 1: an existing-review lookup by (user_id, entity_id) in ReviewForm's subject step, create mode only. It covers SmartComposerButton and ProfileReviews, which both mount ReviewForm. Index: `create unique index reviews_one_active_per_user_entity on public.reviews(user_id, entity_id) where entity_id is not null and status <> 'deleted';`. Map error 23505 to the friendly message.
- Step 2: generalise `postEditPolicy.ts` into a shared `editWindow` helper (posts keep their exact behaviour) and add `canEditReview`. Build one `ReviewOwnerMenu` used by `entity-v4/TimelineReviewCard.tsx`, `components/ReviewCard.tsx` and `profile/reviews/ReviewCard.tsx`. Add a review-specific DB trigger that checks only author-content columns, with an admin bypass. It is not a copy of the post trigger.
