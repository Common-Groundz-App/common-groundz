# Fix: subject lock in Edit, and deleted reviews lingering on the page

## What I found

**Bug 2 (delete) — the delete actually worked.** Hana's review of The Bier Library and its timeline update are both gone from the database (and your reload confirmed it). The page kept showing the old card because nothing told it to reload: the "refresh after any review change" signal is sent, but nothing in the app is listening. Then:
- opening the timeline on that leftover card showed "Anonymous" with no updates, because the review no longer exists;
- deleting it again failed with "Could not delete", because there was nothing left to delete.

The same gap means new reviews, edits and timeline changes can also look stale on the entity page until a reload.

**Bug 1 (subject lock in Edit).** Edit only shows the locked subject card when the review already carries its subject's details. Reviews opened from the entity page and some profile cards don't, so the form falls back to an empty search box.

## What will change

1. **A small dedicated refresh listener** (not the old unused cache helper, which would also switch on unrelated background behaviour). After any successful review create, edit, visibility change, delete, or timeline add/edit/delete, the entity page and profile reload their reviews, numbers and timelines. Failed actions send no signal.
2. **Delete:** on success the card disappears immediately, then the page reloads to confirm. If the review is already gone, it's treated as already deleted: the card is removed and you see "This review was already deleted." Permission problems and connection failures still show an error.
3. **Timeline window:** if the review is confirmed gone, the window closes and the page refreshes. If loading just failed (e.g. offline), it keeps what it showed with a "Try again" option instead of "Anonymous". The same "already gone" handling applies to deleting the latest timeline update.
4. **No leftover timeline cards:** the timeline list is cleared when no timeline reviews remain, and late answers from older requests are ignored, so a deleted review can't reappear.
5. **Edit always shows the locked subject**, exactly like writing a review from the entity page (picture, name, type, tick, "You're reviewing …"). Never a search box, remove button, or new-subject creation.
   - Subject details missing: the form loads them and shows a placeholder locked card meanwhile.
   - Loading fails: shows "Subject unavailable — this review stays linked to its original subject and can't be reassigned", with "Try again". Moving on and saving stay blocked until the subject loads, so nothing is saved with incomplete subject information. A failure is never treated as an old unlinked review.
6. Older unlinked reviews (no subject) keep their current behaviour; they still can't pick a subject.

## Checks

- Tests: locked card in Edit with missing details (loading, loaded, failed, retry; never a search box); "already deleted" treated as deleted while permission/connection errors stay errors; refresh signal only after success; old timeline requests can't restore a deleted review; timeline window closes only on confirmed "gone".
- Full test suite, type check, build.
- Manual checklist for you (signed in): edit from the entity page and your profile shows the locked card; delete a review with a timeline update — the card disappears immediately and doesn't come back, and the counts update; delete the latest timeline update — only it disappears; add a review or timeline update — it shows without reloading.

No Step 3 work and no paused phases.

## Technical details

- New `src/components/system/ReviewChangeInvalidationBridge.tsx`, mounted inside `QueryClientProvider` in `App.tsx`; listens only to `REVIEWS_CHANGED_EVENT` and invalidates `['entity-detail']`, `['reviews']`, plus live stats keys. `CacheProvider` stays unmounted; its listener is removed to avoid two definitions. Audit `notifyReviewsChanged` call sites so each fires only after success (including visibility change and `editLatestReviewUpdate`).
- `useTimelineReviews`: clear map when empty; per-run generation counter (or cancelled flag in cleanup) so stale callbacks are dropped.
- `ReviewOwnerMenu.handleDelete`: `not_found` → `notifyReviewsChanged`, `onDeleted`, info toast; entity-page `TimelineReviewCard`/`ReviewCard` get `onDeleted` that removes the card locally (hidden-id set in `ReviewsSection`) plus invalidation. Profile already refreshes.
- `ReviewTimelineViewer`: distinguish confirmed not-found from fetch error; latest-update delete `not_found` → refresh.
- `ReviewForm` edit mode: subject hydration state `loading | loaded | error`; when `review.entity` is missing, fetch by `entity_id` (or use page `entity` when ids match); `SubjectSelectStep` gets a locked mode with skeleton and error+retry; Next/submit disabled unless `loaded` for linked reviews; `resolution` never falls to legacy-unlinked while `entity_id` exists.
- Add the bridge rule to `AGENTS.md`; add these fixes to `roadmap.md` under Step 2.
