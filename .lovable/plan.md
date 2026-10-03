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
   - Loading fails: shows "Subject unavailable — this review stays linked to its original subject and can't be reassigned", with "Try again". You can still save changes to rating, text, photos, date and visibility, because saving uses the review's existing stored subject and leaves it untouched. The subject-specific questions are hidden in that state and your earlier answers are kept exactly as they were. A failure is never treated as an old unlinked review.
   - Closing the form or switching to another review ignores any late subject answer from the previous one.
6. Older unlinked reviews (no subject) keep their current behaviour; they still can't pick a subject.

## Checks

- Tests: locked card in Edit with missing details (loading, loaded, failed, retry; never a search box); "already deleted" treated as deleted while permission/connection errors stay errors; refresh signal only after success; old timeline requests can't restore a deleted review; timeline window closes only on confirmed "gone".
- Full test suite, type check, build.
- Manual checklist for you (signed in): edit from the entity page and your profile shows the locked card; delete a review with a timeline update — the card disappears immediately and doesn't come back, and the counts update; delete the latest timeline update — only it disappears; add a review or timeline update — it shows without reloading.

No Step 3 work and no paused phases.

## Technical details

- New `src/components/system/ReviewChangeInvalidationBridge.tsx`, mounted inside `QueryClientProvider` in `App.tsx`; one listener on `REVIEWS_CHANGED_EVENT` only — no polling, cache warming, visibility listeners, re-emits or page reloads. It invalidates the query keys verified by static inspection (entity detail, profile review lists, timeline, live stats), not assumed ones. `CacheProvider` stays unmounted; its duplicate listener is removed. Audit `notifyReviewsChanged` call sites so each fires only after success (including visibility change and `editLatestReviewUpdate`).
- `useTimelineReviews`: clear map when empty; per-run generation guard applied to every async state update (loading, success, error).
- Delete sequence: server `deleted` or confirmed `not_found` → remove card locally (hidden-id set in `ReviewsSection`) → close any modal for it → `notifyReviewsChanged` → invalidation reconciles lists and counts. `unauthorized`/transport failure: keep card and modal state, show error with retry, no change event. Profile already refreshes.
- `ReviewTimelineViewer`: distinguish confirmed not-found from fetch error; latest-update delete `not_found` → same reconciliation.
- `ReviewForm` edit mode: hydration state `loading | loaded | error` keyed to the review id (stale responses dropped); fetch entity by `entity_id` when `review.entity` is missing (or use page `entity` when ids match); `SubjectSelectStep` locked mode with skeleton and error+retry, never the selector. Linked = `entity_id` present, regardless of fetch result. On `error`, submit sends only author fields and never `entity_id`/`category`/questionnaire (stored values preserved; DB lock is the backstop).
- Document the bridge in its module comment, `roadmap.md` and the Step 2 verification record — not in `AGENTS.md` (existing rule unchanged).
