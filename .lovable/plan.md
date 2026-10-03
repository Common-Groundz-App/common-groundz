# Fix: subject lock in Edit, and deleted reviews lingering on the page

## What I found

**Bug 2 (delete) — the delete actually worked.** Hana's review of The Bier Library and its timeline update are both gone from the database (checked: no review, no leftover timeline updates). The problem is the page: it kept showing the old card because nothing told it to reload. The "refresh after any review change" listener exists but is never switched on in the app. Then:
- opening the timeline on that ghost card showed "Anonymous" with no updates, because the review no longer exists;
- deleting it again failed with "Could not delete", because there was nothing left to delete.

The same missing listener means other changes (new review, edit, timeline add/edit/delete) can also look stale on the entity page until a hard reload.

**Bug 1 (subject lock in Edit).** Edit only shows the locked subject card when the review already carries its subject's details. Reviews opened from the entity page and some profile cards don't, so the form shows an empty search box instead of the locked card.

## What will change

1. **Turn on the refresh listener** so the entity page reloads its reviews, numbers and timelines right after any review is created, edited or deleted, or a timeline update is added, edited or deleted.
2. **Delete on the entity page:** after a successful delete, the card disappears immediately. If the review is already gone ("not found"), treat it as deleted — remove the card and show "This review was already deleted" instead of an error.
3. **Timeline window:** if the review no longer exists, close the window and refresh instead of showing "Anonymous".
4. **Edit always shows the locked subject**, exactly like writing a review from the entity page (picture, name, type, tick, "You're reviewing …"). No search box, no remove button. If the subject details aren't on hand, the form loads them from the review's linked subject and shows a placeholder card while loading; Next stays available because the subject can't change anyway.
5. Older unlinked reviews (no subject) keep their current text-only behaviour in Edit; they still can't pick a subject.

## Checks

- Tests: edit opened without subject details shows the locked card and no search; delete "not found" is treated as deleted; refresh fires after delete.
- Full test suite and build.
- Manual check for you (signed in): edit a review from the entity page and from your profile — locked card shows; delete a review with a timeline update — the card disappears immediately and doesn't come back.

## Technical details

- Mount `CacheProvider` inside the `QueryClientProvider` in `App.tsx` (its `REVIEWS_CHANGED_EVENT` listener invalidates `['entity-detail']`). Its existing `setInterval` cleanup is replaced with a visibility-guarded `setTimeout` loop per project rule.
- `useTimelineReviews`: clear map when no timeline reviews remain (currently returns early and keeps stale entries).
- `ReviewOwnerMenu.handleDelete`: `not_found` → success path (`notifyReviewsChanged`, `onDeleted`); `TimelineReviewCard`/`ReviewCard` on the entity page get an `onDeleted` that invalidates the entity query.
- `ReviewTimelineViewer`: if the review fetch returns nothing, close and notify.
- `ReviewForm` edit mode: when `review.entity` is missing but `entity_id` exists, fetch the entity by id (also accept the page `entity` prop when ids match) and hydrate `selectedSubject`/`selectedEntity`; `SubjectSelectStep` in edit mode never renders search/clear, renders a skeleton locked card while loading.
