# Step 3C — timeline updates on the review page

Routes (gated like 3B, switch off): `/review/:reviewId/timeline/new`, `/review/:reviewId/timeline/:updateId/edit`.
In-timeline form (`ReviewTimelineViewer.tsx`) and popup unchanged.

## Server contract (read from the live database)
- `edit_latest_review_update`: owner check, advisory lock, latest = `created_at desc, id desc`, `now() >= created_at + 1h` → expired, accepts `yes|maybe|no|auto|null`.
- `review_updates_before_insert` sets `created_at`/`updated_at` to server time.
- `review_updates.would_recommend` has no default: omitted and explicit `null` both store null; the page still keeps them apart in what it sends.

## Parity (in-timeline form vs page)
| Item | In-timeline form | Page | Status |
|---|---|---|---|
| Rating optional | yes | yes, plus Clear | Same (+clear) |
| Would you still recommend it? / tap to clear / Base on rating | yes | same controls | Same |
| Comment required, trimmed | yes | yes, Save disabled when empty | Same |
| Photos up to 4 | yes | 3B uploader (slots, too-many warning, late uploads) | Same+ |
| Untouched recommendation on add | omitted | omitted | Same |
| Cleared recommendation on add | omitted | explicit null | Different on purpose |
| Edit five states round-trip | yes | yes | Same |
| Saved / added toasts | "Timeline update saved" / "Update added" | same | Same |
| Newer update / expired at save | toast, form reset | message, draft kept, "Add a new update" (empty form, nothing copied) | Different on purpose |
| Timeout | none | couldn't-confirm panel, add vs edit retry wording | New |
| Structured fields | none | none | Same |

## Results
Passed: 25 new unit tests (contract table, five-state round-trip, legacy add calls unchanged, every edit-open check, advisory clock, ambiguous copy). Full suite 1025 passed, 3 skipped; type check clean.
Browser (`scripts/e2e/review-timeline-3c.py`, fake sign-in, every write intercepted): 32/32 at 390 and 1280.
Not tested in a browser: real saves, the timeout panel, timeline reopening on the entity page after Save, real uploads, rapid double-Back on these routes.

## Signed-in checklist
1. Open `/review/<your review id>/timeline/new`, add a comment with Yes → entity page opens with the timeline showing it once; Back doesn't reopen it.
2. Add another with no recommendation touched, and one where you pick Yes then tap it off → both show no recommendation statement.
3. Edit the latest via `/review/<id>/timeline/<update id>/edit` within the hour: change only the comment on an update saved with "Base on rating" → still based on rating.
4. Clear the rating while editing → rating gone after save.
5. Open the edit address of an older update → "Cannot edit — A newer update exists."
6. Edit an update older than an hour → form opens with the note; Save shows "Edit window closed (1 hour limit)", text kept.
7. Add photos (try 6 at once), remove one, Cancel → Discard: saved photos stay on the update.
8. From the review page's "You've already reviewed this" → Add timeline update opens the new page.
