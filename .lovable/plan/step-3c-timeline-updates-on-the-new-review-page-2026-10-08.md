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

Recommendation and rating contract (tested state by state):

| What the author did | Add sends | Edit sends |
|---|---|---|
| Never touched it | omitted (no statement) | the loaded value, unchanged |
| Yes / Maybe / No | that value | that value |
| "Base recommendation on rating" | `auto` | `auto` |
| Cleared a selected choice | `null` sent explicitly — kept apart from "never touched" as its own author intent | `null` |
| Rating cleared | omitted | `null` (really clears it) |

Edit loads and keeps all five stored states (`yes`, `maybe`, `no`, `auto`, `null`) exactly; a comment-only edit keeps `auto`. Tests cover what is stored and what the timeline then shows, not only what is sent.

To send an explicit `null` on Add, the shared add function gets one optional, additive setting; every existing caller (the in-timeline form) keeps sending exactly what it sends today. No database change.

- Edit → latest-update edit with full replace. Save-time results always win over what the page checked on open, using today's wording:
  - saved → "Timeline update saved"
  - newer update exists → "Cannot edit — A newer update exists."
  - hour passed → "Edit window closed (1 hour limit)"
  - in both cases the edit form, text and photos stay on screen with the explanation, so nothing typed is lost. "Add a new update" opens a normal, empty new-update form — nothing is copied or carried over, and saved photos are never reused by another update (shared photo ownership would need its own design later). Leaving the edit form follows the 3B rules: saved photos are never deleted; only photos uploaded in this visit are cleaned up.
  - conflict / not yours / not found → clear message, form kept
  - other error → "Failed to save your edit" / "Could not add the timeline update."
- Save locked while pending.
- Timeout → "couldn't confirm" state, nothing assumed; form and photos kept; Save stays locked until the author chooses; no automatic retry:
  - **Add:** the newest timeline entry is shown as evidence ("we found this entry — is it yours?"), never treated as proof, since another entry or identical text could match. "Try again" warns: "This could add a second update if the first one went through." Full duplicate-proofing needs a server-side save key — separate work.
  - **Edit:** the page re-reads **that same update by its id** and compares every field the edit sent — text, rating, recommendation and photos — as evidence only; a mismatch or a failed re-read stays "couldn't confirm". "Try again" warns: "Your edit may already have been saved." It never mentions a second update, and a retry still goes through the latest-only and one-hour checks.

## 3. Opening, access and leaving

- The edit address checks each of these on its own, with its own message: review exists, review is yours, update exists, update belongs to that review, update is the latest (same server order as the timeline: newest time, then id), update is still within its hour. "Not the latest" shows "Cannot edit — A newer update exists.", never "not found". A network failure always shows Retry, never "not found".
- The one-hour rule belongs to the server (checked: it uses the server's own clock, and exactly one hour counts as closed). The page has no cheap way to read the server's current time, so its check on open is only a hint: if the device clock says the hour has passed, the form still opens with a short note ("This update may be past its 1-hour edit window"), and Save gives the real answer. A wrong device clock can never hide an edit that is still allowed.
- Admins: no bypass on timeline edits, matching the server.
- Subjects that can't be shown normally: older reviews with no linked subject show their saved title read-only and still allow updates (as today); a deleted or unavailable subject shows "This subject is no longer available" read-only; nothing is ever attached to a different subject.
- Save and Cancel go to the entity page (built from saved slugs) and reopen the timeline once via the existing one-time marker; Back/Forward never reopen it. When no entity page can be built (no subject or missing slugs), Save/Cancel go to the safe fallback (origin, else Home) with a short note, never an ID address.
- The new hand-off (opening the timeline page from "Add timeline update") applies only to links inside the gated review page.
- Photos in edit: existing photos are never deleted by Cancel or Leave; only photos uploaded in this visit follow the 3B late-upload rules. Same limits as today (4 items, video rules), concurrent uploads and removal included.
- Same leave warnings as 3B (draft / still saving / couldn't confirm); a save finishing after leaving changes nothing on the next screen.
- Tracking: same events as today's timeline form, if it has any; none invented.
- Not included (later structured-timeline phase): best-for, pros/cons, food tags, detail ratings, questionnaires, carried-forward answers. The in-timeline viewer stays as is until 3D.

## 4. Checks

- Unit tests: every row of the contract table above; five-state edit round-trip; every open check and save result → correct message; timeout evidence never claims success; Try-again warning; unlinked/unavailable subject; existing photos never deleted; slot limit shared with 3B.
- Playwright script (faked sign-in, all writes blocked) at 390 and 1280: both routes, validation, not-found, not-yours, not-latest, expired, network Retry, leave warnings, Save/Cancel hand-off reopening once, Back/Forward, rapid double-Back.
- Full suite, typecheck, build. No production writes.
- Parity table (in-timeline form vs page) including the cases above, appended to the verification notes; results reported as passed / failed / not tested; roadmap updated; signed-in add/edit checklist for you. 3C is marked done only after your signed-in check. Stop before 3D.

## Technical details

- Modes `create-timeline-update` / `edit-timeline-update` and `buildCreateTimelinePayload` / `buildEditTimelinePayload` already exist from 3A; the screen gets a timeline branch driven by `caps.steps` (single step) and `caps.subject = 'inherited'`.
- New loaders: `loadReviewForTimeline(reviewId, userId)` and `loadLatestUpdateForEdit(reviewId, updateId, userId)` returning `ok | not_found | unauthorized | wrong_review | not_latest | error`, plus an advisory `mayBeExpired` flag from the device clock. A blocking expired state comes only from the server (the edit function's `expired` result). Latest uses `created_at desc, id desc` (same as `fetchReviewUpdates` and the edit function).
- Timeout evidence: Add → newest row compared with the attempt; Edit → the requested update by id, normalized comment, rating, recommendation and media compared with the sent payload. Result is "matches" or "unclear"; the author always confirms.
- Explicit `null` on Add: verified against the live `review_updates` column during implementation; existing callers regression-tested to send exactly what they send today. Mocked browser tests can't prove storage, so stored/displayed behavior is part of your signed-in checklist.
- Routes added in `App.tsx` inside the same protected wrapper and temporary admin/switch gate; noindex.
- `serverErrors.fromTimelineStatus` maps edit results; `addReviewUpdate` boolean → ok/error.
- `ReviewTimelineViewer.tsx`, `ReviewForm.tsx` untouched. No database changes, no AGENTS.md changes.
