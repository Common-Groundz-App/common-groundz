# Step 3A — Shared composer foundation (built alongside, nothing switched on)

## 3.0A check result

All five fixes are in place:
- F1: author actions (Edit, Add timeline update, Change visibility) are owner-only; admins on others' reviews get only "Remove review (moderation)" with its own wording.
- F2: timeline edit saves and reloads Yes / Maybe / No / auto / no statement separately; the database function has one hardened version.
- F3: timeline updates follow their review's visibility (you confirmed step 1 manually).
- F4: legacy title and place are read-only and never sent on save.
- F5: a review's photo comes only from the reviewer's uploads, otherwise none.
- Change visibility works after the hour.

One small gap: the design document still has some lines from before the fixes in sections 1, 4 and 9, plus the header ("awaiting approval"). **Step 0 of 3A (done first, on its own):** rewrite those lines in place, not as another appended note. The document will then say directly: old title and place are read-only; editing a review never sends identity fields; no upload means no review photo; timeline edit supports auto; author actions are owner-only; visibility can be changed separately; 3.0A is approved and complete.

## What 3A delivers

The building blocks of the new composer. No screen uses them yet, so nobody sees a difference. The old review popup and the timeline form stay exactly as they are.

1. **Mode resolver**: the four modes (new or edited review, new or edited timeline update) each get one complete row: sections, required fields, button label, steps. An unsupported combination is an error, never a quiet fallback.
2. **One typed form store**: one value model with a fixed type for every field (rating, subject, headline, text, photos, date, questionnaire, food tags, visibility, recommendation), plus touched, dirty and error state, and the form's status. Loading a saved record never marks anything dirty. Changing a value and putting it back clears dirty. Moving between steps never loses values, errors or uploads.
3. **Sections own only their field**: each section loads its own value, checks it, and handles its label and error. **Sections never build save data.**
4. **Four save builders, and only these build what gets saved**: they own the cross-field rules. The first photo becomes the cover image. The subject decides title, place and category. Metadata is merged with what's stored. Each mode has its own rule for leaving a value out versus saving it as empty, and for auto versus no statement. They also enforce the fields an edit must never send.
   - new review: title and place come from the saved subject; the photo comes only from uploads; metadata is merged.
   - edit review: can never contain the author, subject, category, title or place (enforced by the types).
   - new timeline update: the comment is trimmed; leaving the recommendation out is different from auto.
   - edit timeline update: all five recommendation states are kept.
5. **Hidden sections are inert**: a section hidden in a mode doesn't check itself, doesn't block Next or Save, doesn't show errors or count as dirty, and never adds or clears anything in what gets saved. Stored values a hidden section holds are carried through only where a save builder deliberately keeps them.
6. **Upload session (F7), lifetime defined**: the ID is created once and kept through re-renders, step changes, failed checks, upload progress, screen-size changes and retries after a temporary error. It changes only when the session itself changes: a different review, a different timeline update, a new review session, or a deliberate reset after a successful save. Cleanup on Cancel covers only this session's uploads, never photos that were already there or entity photos. Photos from a successful save count as kept. After an ambiguous save, nothing is cleaned up.
7. **Step engine**: walks the mode's steps, blocks Next and Save on errors, and focuses the first invalid field.
8. **Save lock**: Save is disabled from the first tap. A timeout moves to "ambiguous" with no automatic retry. Neither the blocked nor the ambiguous state can submit.
9. **My additions**:
   - **Unsaved-changes check**: the store reports one "has unsaved changes" signal based on dirty values plus this session's uploads, so 3B can warn on Cancel or leaving the page using the same rule in every mode.
   - **Same errors for the server's refusals**: a single function turns server responses (window closed, not the latest update, not allowed, existing review, conflict) into the store's blocked reasons, so every mode shows the same message for the same refusal.

## Not in 3A

- No new page, address, switch, popup or entry-point change (3B/3D).
- No change to the old review popup or the timeline form.
- No database change; the rollout switch (F6) waits for 3B.
- No new questions, no headline removal, no structured timeline answers.
- No AGENTS.md change: "one shared composer" isn't true while the old forms are still active. Revisit after 3E.

## How it's checked

Automated tests only:
- **Modes**: all four resolve; unsupported combinations fail; every referenced section exists; every step list is valid.
- **State**: loading doesn't mark dirty; change-and-restore clears dirty; step moves keep values, errors and uploads; switching to another review resets everything; blocked and ambiguous states can't submit.
- **Hidden sections**: they don't validate, block, show errors, count as dirty or change what gets saved.
- **Edit paths, not just round trips**:
  - load, change one field, save: the other fields stay unchanged;
  - unknown stored metadata and questionnaire keys survive;
  - review edit never contains identity fields;
  - a timeline update saved as auto, with only its comment edited, still saves as auto;
  - cleared and untouched values stay distinct.
- **Save builders**: identity comes from the saved subject; no upload means no cover image; a new timeline update keeps "left out" and auto apart; timeline edit keeps all five states.
- **Upload session**: stable across re-renders and steps; a new ID for a new session; cleanup lists only this session's uploads; saved photos count as kept; nothing is cleaned up after an ambiguous save.
- **Boundary**: no existing screen imports the new module; the old forms are untouched; the existing tests pass unchanged.

The docs and roadmap are updated, and 3A is marked done, only after the implementation and its tests pass. Then I stop for your approval before 3B.

## Technical details

- Module `src/components/review-composer/`: `modes.ts`, `values.ts`, `store.ts` (useReducer + context), `sections/*.ts`, `saveBuilders.ts`, `serverErrors.ts`, `useUploadSession.ts`, `stepEngine.ts`, `__tests__/`. A header comment in each file says the module is unused until cutover.
- `ReviewComposerValues` interface; `SectionValueMap` keys map to exact types; no `Record<SectionId, unknown>` and no casts. `MODES satisfies Record<ComposerMode, ComposerCapabilities>`.
- Section contract: `{ id, visible(caps), hydrate(record) → SectionValueMap[id], validate(value, mode) }`. There is no serialize on sections.
- The edit-review payload type uses `Omit`/`never` for `user_id | entity_id | category | title | venue`.
- Builders reuse `resolveReviewIdentity`/`identityPersistence`, `buildReviewMetadataForSave` (merge), `toTimelineRecommendationValue` and the questionnaire `registry`/`resolve`.
- `useUploadSession(sessionKey)`: the key is `mode + reviewId/updateId`, or a per-mount nonce for new reviews. The ID is set lazily (`ref.current ??= generateUUID()`) and regenerated when the key changes. The hook tracks `sessionUploads` and `committed`.
- A grep check in the tests confirms no file outside the module imports from it.
- Close-out: `docs/verification/review-composer-3a.md`, the design-doc boundary note, and roadmap updates. AGENTS.md is unchanged.
