# Step 3 — One shared review composer (final, design gate first)

## The decision and why

Both reviewers agree on the same four refinements, and each fixes a real risk. This is the combined approach:

1. **Three independent settings, plus one settings table** (ChatGPT's model with Codex's table).
   - `entryType: review | timeline-update`, `operation: create | edit`, `presentation: page | modal`.
   - The first two combine into one of four modes. Each mode reads its fields and rules from a single, complete settings table.
   - Why: every difference between the four cases stays visible in one place, and presentation can never change fields, validation, permissions or saving. Adding a "sheet" later, or a "quick" variant, won't multiply modes.

2. **Page by default. The old popup is a temporary backup only.**
   - The new composer body is built once and can be shown inside a page (default) or a popup wrapper.
   - The current popup form stays untouched as an emergency fallback while you test. A switch you can flip without a code change chooses between them.
   - Why: you get the safety net you asked for. Keeping the old form forever would bring back two forms to maintain, which is exactly what Step 3 removes. Once all four flows pass checks, the old form is retired. If you later want a popup, it shows the same new composer.

3. **Clear page addresses.**
   - Each address names exactly what it edits, so refreshing the page works.
   - Editing a timeline update names that exact update. It fails safely if a newer update has been added since.
   - Why: an old link can never edit the wrong entry.

4. **Timeline updates keep today's fields during the move.**
   - Those fields are rating (optional), "Would you still recommend it?" with its rating-based reset, what changed, and photos.
   - Extra questions (pros/cons, best for, food tags, detail ratings) stay hidden on updates until a separate storage design is approved.
   - Why: we won't build screens before we know how a changed answer is kept in history.

The timeline popup becomes read-only history. "Add timeline update" and "Edit" open the composer page; Save and Cancel return you where you came from.

## Delivery order (each part is checked before the next)

1. **Design gate (this approval).** I produce the items under "Design gate deliverables" below. No behavior changes.
2. Pull out the shared pieces: rating, recommendation, written text, photos, locked subject, date, visibility, and the questionnaire.
3. Build the new composer and its page, with an optional popup wrapper.
4. Move the flows over one at a time: create review, edit review, add timeline update, edit timeline update. Each must match today's behavior before the next one moves.
5. Make the timeline popup read-only and point every entry point to the page. The old popup stays behind the backup switch.
6. Run the full parity checks on desktop and mobile, then you test.
7. Remove the old forms once the retirement conditions are met (all four flows pass, and you approve after testing).
8. Separately: the storage design for timeline-update answers, then the paused richer-review phases, added once in the shared composer.

## Not in Step 3

- No full drafts or autosave. Only refresh-safe pages and a basic "discard changes?" prompt.
- No database changes.
- No change to the one-hour rule, latest-only editing, Delete, one review per person, or the post composer.

## Design gate deliverables

- **Current field matrix**: review create/edit vs timeline create/edit, covering fields, required rules, defaults, where each value is saved, and who is allowed.
- **Capability table**: all four modes. Shows the subject as select or locked, rating required or optional, recommendation mode, text wording, media, date, visibility, and questionnaire. The questionnaire is hidden for timeline modes. Confirms page and popup behave the same.
- **State model**: shared and per-mode values, unsaved-change tracking, upload state, loading saved data, and the expired-window, no-longer-latest and deleted states.
- **Saving per mode**: the exact data each mode sends, how "left alone" differs from "cleared", how saved metadata is preserved, and the recommendation rating-based reset.
- **Page address contract**: `/reviews/new` (subject from entity context), `/reviews/:reviewId/edit`, `/reviews/:reviewId/updates/new`, `/reviews/:reviewId/updates/:updateId/edit`. These are noindex and sign-in gated. Each page loads by ID and works on refresh. Return context travels as one-time navigation state, never as the only copy of identity. Entity return paths use the stored slugs (existing rule), and `?compose=update` deep links redirect to the update page.
- **Timeline answer storage (write-up only)**: each update records only the answers it changed, the review holds the current answers, untouched answers carry forward, and history shows how they changed. It lists the open questions: edit/undo, versioning, unknown fields, stats, recommendation precedence, older timelines.
- **Migration, backup and retirement plan**, with the backup switch's location and the conditions for removing the old form.
- **Parity checklist**: the four flows, the one-hour rule, latest-only editing, media, recommendation resolution, Back/Cancel, refresh, mobile keyboard, and accessibility.

## Technical details

- `resolveComposerMode({ entryType, operation })` maps to `REVIEW_COMPOSER_MODES: Record<ComposerMode, ComposerCapabilities>`. The table must cover every mode, and the JSX never checks the mode.
- `ReviewComposer` takes no presentation input for its logic. `ReviewComposerPage` (default) and `ReviewComposerModal` are thin shells around it.
- Saving uses the existing `createReview`, `updateReview`, `addReviewUpdate` and `editLatestReviewUpdate` unchanged. Database triggers and RPCs are untouched.
- The backup switch is a read-at-runtime config value, not a hardcoded constant. Each switch use is recorded in the roadmap together with its retirement date.
