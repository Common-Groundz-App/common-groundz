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
| Rating optional | yes | yes (no extra Clear button, removed in 3C.1) | Same |
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

## Final audit (2026-10-08, after your signed-in checks)
Database (review 8fa6b2a4…, Isha Foundation Chikkaballapura):
- New update 9884785f…: correct review_id, owner = review author, comment trimmed, rating 2, would_recommend `no`, 2 photos with session ids, created_at server time; edited at 11:33 on the **same row** (updated_at moved, created_at unchanged, 4 rows total — no duplicate).
- Review recomputed: timeline_count 4 = rows, has_timeline true, latest_rating 2 = newest rated update.
- No new reviews created; no invalid recommendation values (all rows are null/yes/maybe/no/auto); 0 updates authored by someone other than the review owner.
- Insert rule: only the review's owner can add (`user_id = auth.uid()` and owns the review). Edit function: owner, latest-only under lock, server-clock hour, no admin bypass.
- **Finding, fixed:** each Oct 8 session (`8d661012…`, `3acac8bc…`) uploaded 4 photos but saved 2; the 2 removed before saving stayed in storage unreferenced (4 files in total). The same gap existed on the 3B review page. Now, after a *confirmed* save only, photos uploaded in that visit and not saved are deleted — never saved/pre-existing photos, never while saving or unconfirmed.
- **Correction (Oct 9):** a further 4 orphans in Oct 6 session `8162b991…` came from a 3B draft left without Save or Cancel (none saved) — not from over-limit uploads. Total: 12 files = 4 referenced + 8 orphans. Exact list and reference check: docs/verification/media-lifecycle-audit.md.
- Known, unchanged: photos removed from an already-saved update during an edit are left in storage (same as the in-timeline form).

Scope: no app button links to the new routes; `ReviewTimelineViewer.tsx` and `ReviewForm.tsx` unchanged in 3C. **The rollout switch `reviews.composer_page_enabled` is currently ON in the database** (set from the admin panel), so any signed-in user who types a `/review…` address can use the page. Buttons still open the legacy flow.
Tracking: the in-timeline form records no events, so the page records none.
Tests: 1026 passed, 3 skipped; type check clean; browser check 32/32.

## 3C.1 close-out (2026-10-09)
- Rating "Clear" button removed — rating now matches the in-timeline form exactly.
- Rollout switch confirmed OFF in the database.
- Browser (`scripts/e2e/review-timeline-3c.py`, fake sign-in, writes intercepted; slow saves simulated by holding the fake answer past the 20 s limit), 390 and 1280: **56/56 required checks passed**, including:
  - Add timeout: newest entry shown as "is it yours?", never called saved; "could add a second update" warning; Save locked until "Try again"; leaving warns "couldn't confirm".
  - Edit timeout: that same update re-read; match → "Your edit looks saved" + "Yes, it saved"; mismatch → "couldn't confirm your edit"; edit-only warning, no "second update" wording.
  - Back → Keep → Back again stays protected on both pages.
- **Rapid double-Back: ESCAPES on both timeline pages at both widths** (two Back presses fired back-to-back in the same instant leave the page to the previous screen; the draft is not kept). Single Back, repeated Back with Keep, Cancel and in-page links stay protected. Decision needed: accept as a documented browser-router limit, or ask for a fix.
- Full suite, type check and build rerun.
