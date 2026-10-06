# 3B final audit: popup vs new review page parity

Goal: confirm 3B is complete with no leftovers, and that everything the review popup does is also on the new review page. 3C stays on hold until this is approved.

## 1. Side-by-side parity check (popup vs page)

Go through the popup (review form and its steps) and the new page step by step, and record each item as Same / Different on purpose / Missing:

- Step 1 subject: search, quick-create a new subject (incl. "Data conflict", "Subject added", "Using the existing entry", "Could not create" messages), blocked subjects ("We can't use this one yet").
- Step 2 rating: rings rating, "Rating required" when skipping it.
- Step 3 details: headline, text, structured fields, per-type questions, recommend toggle, visibility.
- Step 4 photos: location prompt, subject card, legacy read-only fields, 4-photo limit + "Too many files" warning, failed upload message, ordering/removal.
- Navigation: step dots / "Cannot skip steps", Back/Next, Cancel and leave warnings.
- Publish/save: "Subject required" / "We can't review this subject" / "We can't publish this review yet" guards, success message ("Review has been added / updated"), failure message, where the user lands afterwards.
- Edit an existing review: prefill, 1-hour edit window, immutable subject.
- Add timeline update entry point and its messages.
- Phone and desktop layout of each step.

Already seen in a first scan: the popup shows separate messages for missing rating, missing subject, skipping steps and success; the page has a smaller set of messages. Each one will be checked to see whether the page covers it another way (e.g. a disabled button or an inline note) or it is truly missing.

## 2. 3B leftovers check

- Every 3B item in the approved plan and roadmap is done and tested (uploads, slot limits, late uploads, leave warnings, location prompt, subject card).
- No dead code, debug logging, or temporary admin-only hooks left beyond the agreed rollout switch.
- Popup still unchanged (frozen).
- Verification notes doc and roadmap reflect the final state.

## 3. Fix what is truly missing

- Add any missing message or behaviour to the page using the popup's exact wording, without touching the popup.
- Items that differ on purpose are listed with the reason, not changed.
- Add a test for each fix; rerun the full test suite and the repeatable browser check (no real saves).

## 4. Report

A short table for you: item, popup, page, status — plus a short manual check list for anything that needs your signed-in test.

## Technical notes

- Sources: `ReviewForm.tsx`, `steps/*`, `SubjectQuickCreate.tsx` vs `review-composer/screen/ReviewComposerScreen.tsx`, `sections/*`, `stepEngine.ts`, `saveBuilders.ts`, `serverErrors.ts`.
- Results appended to `docs/verification/review-composer-3b.md`; roadmap updated.
- No database changes, no production writes, no AGENTS.md changes.
