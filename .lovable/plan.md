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
   - edit review: can never contain the author, subject, category, title, place or status.
   - new timeline update: the comment is trimmed; leaving the recommendation out is different from auto.
   - edit timeline update: all five recommendation states are kept.
   - **Allowlist at run time, not only in the types**: each builder lists exactly the fields it sends. None of them starts from the whole form or the loaded record and removes keys afterwards. Timeline payloads follow the same rule, so review fields can never slip in.
5. **Three kinds of "not showing"**, each with its own rule:
   - **Not used in this mode** (for example, the questionnaire in a timeline update): fully inert. It isn't checked, doesn't block, shows no errors, doesn't count as dirty, and is left out of what gets saved.
   - **On another step** (for example, photos while you're on step 1): still active. It stays dirty, is still checked and saved, and still counts as an unsaved change.
   - **No longer fits after the subject changes** (Food to Book, or Book to Food): an explicit reset clears the answers given this session that no longer fit, never saves stale ones, and marks the change as dirty. Stored answers that this build doesn't understand are kept when editing.
6. **Old results can't overwrite the current session**: each session has its own key (new review, edit review X, new update on X, edit update Y on X). Every slow result is checked against the active key before it can change anything: loaded data, a subject lookup, an upload finishing, a check result, or a save result (success, error or ambiguous). If the user has moved on, it's ignored.
7. **Upload session (F7), lifetime tied to the session, not to a screen piece**: the ID belongs to the session controller, not to any child part of the screen. It survives re-renders, step changes, failed checks, upload progress, layout or screen-size remounts, page-shell changes, and retries after a temporary error. A new ID is made only when a real new session starts: a different review, a different update, a new review session, or a deliberate reset after a successful save. Changing the session never cleans up the old session's uploads until it's settled whether they were saved. Cancel cleans up only this session's uploads, never photos that were already there or entity photos. Saved photos count as kept. Nothing is cleaned up while a save is ambiguous.
8. **Step engine**: walks the mode's steps, blocks Next and Save on errors, and focuses the first invalid field.
9. **Save lock**: Save is disabled from the first tap. "Blocked" can't submit. "Ambiguous" (after a timeout) keeps the form and disables Save. In 3B the page fetches the latest state from the server and shows it to the user. The user decides: go back, or retry by hand. Save never unlocks or retries on its own.
10. **My additions**:
   - **Unsaved-changes check**: one signal for every mode, based on dirty values plus this session's uploads. 3B will use it to warn on Cancel or when leaving the page.
   - **Server refusals arrive already sorted**: the composer only receives typed results (ok, expired, not_latest, unauthorized, existing_review, conflict, not_found, error). It never reads error text itself. The services do the sorting:
     - timeline services already return these statuses;
     - a duplicate review is recognised by its database code plus the constraint name;
     - review Edit still recognises "window closed" through the one existing helper, `isEditWindowClosedError`, until the server returns a typed result. That would be a separate, approved database change, and the composer gets no second copy of this check.
     - Unknown errors stay real errors.
   - **Ambiguous saves give evidence, not a verdict**: a lookup returns "possible saved item found" (and shows it), "not seen", or "lookup failed". How strong the evidence is depends on the mode:
     - new review: strong, because there's only one review per person and subject. It shows the saved review, without assuming every field matches;
     - edit review / edit update: reload that exact record and compare it with what was sent. A change from another tab can still leave it unclear;
     - new timeline update: weak. The latest update is shown for the user to judge, because without a submission key from the server, nothing can prove it was this attempt. It never counts as confirmed.
     A guaranteed answer needs a server submission key, which stays separate work.
   - **Closing during an ambiguous save**: this session's uploads count as "unsettled". They're never cleaned up, so a review that may already be saved never loses its photos.

## Not in 3A

- No new page, address, switch, popup or entry-point change (3B/3D).
- No change to the old review popup or the timeline form.
- No database change; the rollout switch (F6) waits for 3B.
- No new questions, no headline removal, no structured timeline answers.
- No AGENTS.md change: "one shared composer" isn't true while the old forms are still active. Revisit after 3E.

## How it's checked

Automated tests only:
- **Modes**: all four resolve; unsupported combinations fail; every referenced section exists; every step list is valid.
- **State**: loading doesn't mark dirty; change-and-restore clears dirty; step moves keep values, errors and uploads; switching to another review resets everything; "blocked" can't submit; "ambiguous" can't submit until the user explicitly chooses to retry, and evidence alone never unlocks it.
- **Evidence lookup**:
  - new review found → "candidate found";
  - new timeline update → never "confirmed", only a candidate or "not seen";
  - lookup failure → "lookup failed", and the form stays as it is;
  - an old session's lookup result is ignored.
- **Server results**: the composer module contains no message matching (checked by a grep for `.message` / `includes(` on error text).
- **Three kinds of "not showing"**:
  - moving between steps;
  - collapsing an optional section;
  - Food → Book and Book → Food;
  - editing a review with unknown questionnaire fields;
  - questionnaire data while in a timeline mode.
- **Old results**:
  - review A finishes loading after review B is open;
  - closing during loading;
  - changing the subject while its lookup is running;
  - an old upload finishing after the session changed;
  - an old save result arriving after moving to another review. None of these may change the current session.
- **Edit paths, not just round trips**:
  - load, change one field, save: the other fields stay unchanged;
  - unknown stored metadata and questionnaire keys survive;
  - a timeline update saved as auto, with only its comment edited, still saves as auto;
  - cleared and untouched values stay distinct.
- **Allowlist**: each builder's output equals the exact expected object. Edit review has no `user_id`, `entity_id`, `category`, `title`, `venue` or `status`, even when the input is spread from a loaded record that contains them. Timeline payloads contain no review fields.
- **Save builders**: identity comes from the saved subject; no upload means no cover image; a new timeline update keeps "left out" and auto apart; timeline edit keeps all five states.
- **Server refusals**: each code maps correctly; unknown errors stay errors; nothing depends on error text.
- **Upload session**: the ID survives re-renders, step changes and remounts of child parts; a new ID only for a new session; an old session's uploads aren't cleaned up when the session changes before the save is settled; cleanup lists only this session's uploads; saved photos count as kept; nothing is cleaned up while a save is ambiguous.
- **Boundary**: no existing screen imports the new module; the old forms are untouched; the existing tests pass unchanged.

The docs and roadmap are updated, and 3A is marked done, only after the implementation and its tests pass. Then I stop for your approval before 3B.

## Technical details

- Module `src/components/review-composer/`: `README.md` (one module note: introduced in 3A, unused until the page integration, old forms stay independent during rollout), `modes.ts`, `values.ts`, `store.ts` (useReducer + controller), `sections/*.ts`, `saveBuilders.ts`, `serverErrors.ts`, `reconcile.ts`, `useUploadSession.ts`, `stepEngine.ts`, `__tests__/`. File comments describe each file's lasting job, not the rollout status.
- `ReviewComposerValues` interface; `SectionValueMap` keys map to exact types; no `Record<SectionId, unknown>` and no casts. `MODES satisfies Record<ComposerMode, ComposerCapabilities>`.
- `SectionAvailability = 'enabled' | 'mode-disabled' | 'not-rendered'`. Subject change dispatches `SUBJECT_CHANGED`, which resets incompatible session answers and keeps unknown stored keys, matching the legacy `questionnaireReset` contract.
- Section contract: `{ id, availability(caps, values), hydrate(record) → SectionValueMap[id], validate(value, mode) }`. There is no serialize on sections.
- Session key: `create-review:<nonce>` | `edit-review:<reviewId>` | `create-timeline-update:<reviewId>` | `edit-timeline-update:<reviewId>:<updateId>`. The nonce is created once by the controller that owns the logical session, never by a child mount. Every async action carries its key; the reducer drops actions whose key isn't current.
- Builders return object literals built from named fields, plus a type-level `Omit` as a second guard.
- `useUploadSession(sessionKey)`: `ref.current` holds `{ key, id }` and is regenerated only when the key changes. It tracks `sessionUploads`, `committed` and `settled`; cleanup is never triggered by a key change alone.
- `serverErrors.ts` defines `ComposerServerResult` (`ok | expired | not_latest | unauthorized | existing_review{reviewId} | conflict | not_found | error{cause}`) and service-boundary adapters. Timeline uses the existing RPC statuses; create maps 23505 + `reviews_one_per_user_entity`; review edit calls the existing `isEditWindowClosedError`. There is no new message parsing.
- `reconcile.ts` returns `AmbiguousSaveEvidence = candidate-found{candidate, strength: 'strong'|'compare'|'weak'} | not-observed | lookup-failed{error}` and never `confirmed`. It uses `findOwnReviewForEntity`, an exact-ID reload, and the latest-update fetch; it's session-keyed and tested with mocks.
- The step engine returns the first invalid section ID; the screen moves focus to it in 3B.
- A grep check in the tests confirms no file outside the module imports from it.
- Close-out: `docs/verification/review-composer-3a.md`, the design-doc boundary note, and roadmap updates. AGENTS.md is unchanged.
