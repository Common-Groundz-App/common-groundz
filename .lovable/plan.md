# Step 3C — Timeline updates on the new review page

Goal: the new review page can also **add** a timeline update and **edit the latest** one, with the same fields, rules and messages as today's in-timeline form. It stays hidden behind the same rollout switch (off), and every existing button still opens today's popup/timeline until 3D. The in-timeline form is not changed.

## What you will be able to test (admins, switch off)

- `/review/<reviewId>/timeline/new`: add an update to your own review.
- `/review/<reviewId>/timeline/<updateId>/edit`: edit your latest update within its hour.
- On the review page, "Add timeline update" (already-reviewed notice and expired-edit panel) opens the new page instead of the entity page — only while the page is in use.

## 1. One-step timeline form (parity with the in-timeline form)

Single screen, in this order:
- Subject card (read-only, inherited from the review — never changeable).
- Rating (optional, tap to clear).
- "Would you recommend it?" Yes / Maybe / No, tap again to clear, plus "Base recommendation on rating" (reset).
- "What changed?" text — required, trimmed.
- Photos (up to 4), reusing the 3B uploader, slot limit, "too many files" warning and late-upload rules.
- Save / Cancel. Same validation messages as today ("comment required").

Edit mode prefills rating, recommendation (including reset), text and photos from the update.

## 2. Saving (exact mappings already approved)

- Add → insert update; rating/recommendation **omitted** when untouched; reset sends `auto`.
- Edit → latest-update edit with full replace; results handled with today's wording:
  - saved → "Timeline update saved"
  - newer update exists → "Cannot edit — A newer update exists."
  - hour passed → expired panel (no form), with "Add a new update" instead
  - conflict / not yours / not found → clear message, form kept
  - other error → "Failed to save your edit" / "Could not add the timeline update."
- Save locked while pending. Timeout → "couldn't confirm" state: form kept, latest timeline entry shown, no automatic retry (add returns no id, so duplicate protection stays out of scope).

## 3. Opening, access and leaving

- Loading: skeleton. Malformed id / missing review or update → "not found". Someone else's review → "You can only add updates to your own review". Network error → Retry.
- Edit: only your latest update, within its own hour (admins: no bypass on timeline edits, matching the server).
- Save and Cancel go to the entity page (built from saved slugs) and reopen the timeline once via the existing one-time marker; Back/Forward never reopen it. Same leave warnings as 3B (draft / still saving / couldn't confirm).
- Tracking: same events as today's timeline form, if it has any; none invented.

## 4. Checks

- Unit tests: payload omitted vs explicit vs `auto`; every edit result → correct message/state; access states; prefill round-trip incl. reset; slot limit shared with 3B.
- Playwright script (faked sign-in, all writes blocked) at 390 and 1280: both routes, validation, not-found, not-yours, expired, leave warnings.
- Full suite, typecheck, build. No production writes.
- Parity table (in-timeline form vs page) appended to the verification notes; roadmap updated; short signed-in checklist for you. Stop before 3D.

## Technical details

- Modes `create-timeline-update` / `edit-timeline-update` and `buildCreateTimelinePayload` / `buildEditTimelinePayload` already exist from 3A; the screen gets a timeline branch driven by `caps.steps` (single step) and `caps.subject = 'inherited'`.
- New loaders: `loadReviewForTimeline(reviewId, userId)` and `loadLatestUpdateForEdit(reviewId, updateId, userId)`; ownership via the review row, latest-only via the existing latest-update RPC.
- Routes added in `App.tsx` inside the same protected wrapper and temporary admin/switch gate; noindex.
- `serverErrors.fromTimelineStatus` maps edit results; `addReviewUpdate` boolean → ok/error.
- `ReviewTimelineViewer.tsx`, `ReviewForm.tsx` untouched. No database changes, no AGENTS.md changes.
