# Step 3A — Shared composer foundation (built alongside, nothing switched on)

## 3.0A check result

All five fixes are in place:
- F1: author actions (Edit, Add timeline update, Change visibility) are owner-only; admins on others' reviews get only "Remove review (moderation)" with its own wording.
- F2: timeline edit saves and reloads Yes / Maybe / No / auto / no statement separately; the database function has one hardened version.
- F3: timeline updates follow their review's visibility (you confirmed step 1 manually).
- F4: legacy title and place are read-only and never sent on save.
- F5: a review's photo comes only from the reviewer's uploads, otherwise none.
- Change visibility works after the hour.

One small gap: the design document still has a few pre-fix lines in sections 1, 4 and 9 (e.g. "parity keeps the entity image", "auto cannot be expressed", status "awaiting approval"). The resolved table below them is correct. 3A starts by correcting those lines so the document has one truth.

## What 3A delivers

The building blocks of the new composer, unused by any screen. Nobody sees a difference. The old review popup and the timeline form stay exactly as they are.

1. **Mode resolver** — one function turns (review or timeline update) × (create or edit) into the capability row from the design table: which sections show, what's required, button label, step list.
2. **One form store** — holds every value, its starting value, touched/dirty/error, plus form status (loading, ready, saving, ambiguous, blocked) and a reason when blocked. Moving between steps never loses values or interrupts uploads.
3. **Section registry** — each section (rating, subject, photos, headline, text, experience date, questionnaire, food tags, visibility, recommendation) declares how it loads from a saved record, checks itself, and turns into save data. No section knows which screen it's on.
4. **Save builders** — four functions producing exactly the corrected 3.0A save data:
   - new review: same fields as today; title/place from the subject; photo only from uploads; questionnaire merged, never replaced.
   - edit review: never sends title, place, subject or category.
   - new timeline update: comment trimmed; rating and recommendation left out when untouched.
   - edit timeline update: recommendation is one of yes / maybe / no / auto / no statement.
5. **Stable upload session (F7)** — one upload ID created when a composer session starts, kept across steps and re-renders, renewed only for a genuinely new session. It also tracks files uploaded in this session for best-effort cleanup on Cancel (never older, kept or entity photos).
6. **Step engine** — walks the step list from the mode row, blocks Next/Save on errors, focuses the first invalid field.
7. **Save lock** — Save is disabled from the first tap until the server answers; a timeout moves to "ambiguous" with no automatic retry.

## Not in 3A

- No new page, address, switch, or entry-point change (3B/3D).
- No change to the old review popup or timeline form (frozen rollback).
- No database change. The rollout switch (F6) waits for 3B.
- No new questions, no headline removal, no timeline structured answers.

## How it's checked

Automated tests only (nothing visible to test by hand yet):
- mode resolver returns each of the four rows exactly as in the design table;
- every section loads → saves back to the same values (round trip) for each mode;
- each save builder matches the corrected mapping, including "edit review sends no identity fields", "no upload → no photo", and the five recommendation states;
- step changes keep values and the upload session ID; a new session gets a new ID;
- Cancel cleanup list contains only this session's uploads;
- save lock blocks double submission; timeout goes to ambiguous without retrying;
- existing review/timeline tests still pass unchanged.

Then I stop for your approval before 3B.

## Technical details

- New folder `src/components/review-composer/` (`modes.ts`, `store.ts` via `useReducer` + context, `sections/*.ts` registry, `saveMappings.ts`, `useUploadSession.ts`, `stepEngine.ts`, `__tests__/`). Reuses existing helpers rather than copying: `resolveReviewIdentity` / `identityPersistence`, `buildReviewMetadataForSave`, questionnaire `registry`/`resolve`, `toTimelineRecommendationValue`, `reviewEditPolicy`, owned-media cleanup service.
- Section contract: `{ id, visible(caps), hydrate(record), validate(value, mode), serialize(value) }`; serialize output for edit-review is typed so title/venue/entity_id/category cannot be included.
- Upload session: `useRef(uuidv4())` created once per session key; `sessionUploads` recorded in the store from the uploader callback.
- No imports from the new folder into any existing screen; verified with a grep in the close-out.
- Doc tidy: update `docs/review-composer-design.md` sections 1, 4, 9 and header to post-3.0A truth; mark 3.0A approved and 3A done in `roadmap.md`.
- Record in `AGENTS.md`: "The review composer's modes, sections and save mappings live in one shared module; screens only render it — so create/edit for reviews and timeline updates can't drift."
