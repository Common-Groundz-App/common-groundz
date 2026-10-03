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
- **Entity page, extra gap:** the page only loads public reviews. If your review is private or Circle-only, it still shows "Write review" and can create a second one.

What changes:
- One shared check answers "have I already reviewed this?" It looks at all your reviews, whatever their visibility. It is used by the entity page button, the review form, and the recovery below.
- In the review form, after you pick a subject, the Next and Publish buttons wait while the check runs.
  - **Not reviewed yet:** you carry on as normal.
  - **Already reviewed:** the form stops and shows "You've already reviewed this" with **Add an update** (opens that review's update form) and **Cancel**.
  - **The check itself fails** (for example you're offline): you can't continue, and you get **Try again**. A failed check is never treated as "not reviewed".
- When editing a review, switching it to a subject you already reviewed elsewhere is blocked the same way.
- A database rule allows exactly one review per person per subject. Reviews are fully deleted, so there's no exception for deleted ones. Old reviews with no linked subject are not affected. The duplicate check is re-run first; if anything turns up, I stop and show you.
- If two saves land at the same moment (double-tap, two tabs), the rule keeps exactly one. The other screen finds the saved review and offers **Add an update**, instead of showing an error. Any other database error still shows as a real error, never hidden.

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
- Step 1: add `findOwnReviewForEntity(entityId, { excludeReviewId? })` in `src/services/review/`.
  - It reads the owner from the signed-in session, never from a caller-supplied ID. No session counts as `error`.
  - It returns `{status:'found', review} | {status:'none'} | {status:'error'}` and is not filtered by visibility. The existing read rule already lets an owner read all their own reviews: `visibility = 'public' OR user_id = auth.uid()`.
  - It is used by ReviewForm's subject step (create, plus edit when the subject changes, excluding the review itself), by the EntityV4 Write/Add-update button, and by race recovery. ReviewForm covers SmartComposerButton and ProfileReviews.
- Index: `create unique index reviews_one_per_user_entity on public.reviews(user_id, entity_id) where entity_id is not null;`. Only a 23505 whose constraint/message names `reviews_one_per_user_entity` triggers recovery.
- Production checks are read-only: the duplicate count before the migration, then catalog queries confirming the index exists with the right columns and condition. No test writes go to production. There is no separate test database, so true two-session concurrency is reported as unverified.
- Unit tests:
  - lookups for public, Circle-only and private own reviews
  - the pending, failure and retry states
  - the Home, Profile and Entity entry points
  - an edit-mode subject switch
  - recovery only on this rule's error, while other errors still surface
- Then the full test suite, a type check, the build, and a list of signed-in checks for you. Steps 2 and 3 are not started.
- Step 2: generalise `postEditPolicy.ts` into a shared `editWindow` helper (posts keep their exact behaviour) and add `canEditReview`. Build one `ReviewOwnerMenu` used by `entity-v4/TimelineReviewCard.tsx`, `components/ReviewCard.tsx` and `profile/reviews/ReviewCard.tsx`. Add a review-specific DB trigger that checks only author-content columns, with an admin bypass. It is not a copy of the post trigger.
