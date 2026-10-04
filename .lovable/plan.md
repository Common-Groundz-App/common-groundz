# Step 3 — One shared review composer (final, design gate first)

## The decision and why

Both reviewers approve the direction. Their remaining points are refinements, and all of them are adopted.

1. **Three independent settings, plus one settings table.**
   - `entryType` is review or timeline-update. `operation` is create or edit. Together they pick one of four modes.
   - A complete settings table, keyed by mode, holds all business behaviour: fields, required rules, and the wording for each case ("Tell people about your experience" vs "What changed?").
   - Presentation (page or popup) belongs to the outer frame only. It never affects fields, validation, permissions or saving.
   - Why: every difference lives in one place, and a future popup or sheet adds no new modes.

2. **Only the new page is built now.**
   - The composer works independently of whatever frame it sits in, but Step 3 builds only `ReviewComposerPage`.
   - The current popup form stays frozen as a temporary backup.
   - A new popup frame is built later only if there is a real need. It would hold the same new composer, never the old form.
   - Why: this avoids building and testing two frames before the page has proven itself.

3. **One `/review` page address, like `/create` for posts.** Selecting an entity never changes the address (details in "Clarifications" below).

4. **Timeline updates keep today's fields during the move.**
   - The fields are: what changed, an optional rating, "Would you still recommend it?" with its rating-based reset, and photos.
   - Extra questions stay hidden on updates until a separate storage design is approved.

5. **The backup switch uses the app's existing settings system** (the same one used for video uploads and live notifications). No new switch system is built.

The timeline popup becomes read-only history. This happens only after both timeline flows pass their checks on the page.

## Clarifications the reviewers asked for

**Page address: one `/review` page, like `/create` for posts**

The earlier draft gave each case its own address, such as `/reviews/new?entity=...`. That is replaced with one `/review` page, the same pattern posts already use. Why:
- **Selecting an entity never changes the address.** You pick, change or create a subject on the page, as you do in the post composer today.
- **Background entity creation keeps working as it does now.** When a subject isn't found, the existing find-or-create step makes it behind the scenes and hands its ID to the form. A brand-new entity has no stored slug yet, which is one more reason not to put entity names in the address.
- **One address for all four cases.** The page is told what to do (new review, edit, add update, edit update) and which review or update it is for, in the same way the post page is handed an entity today.

What separate addresses would have bought, and how we cover it instead:
- **Refresh mid-form.** A new review falls back to the subject picker, as `/create` does. Edit, add update and edit update show "This form was closed — open it again from your review" with a button back to the entity or profile. They never guess which review.
- **Shareable links.** Nobody shares a link to their own edit form, so nothing is lost.
- **Old `?compose=update` links** still open the timeline on the entity page, as today.

Unchanged safety rules:
- Edit, add update and edit update always re-check on the server that the review or update is yours, that an edit is still inside the hour, and that a timeline update is still the latest. Saving never trusts what was passed to the page.
- If you already reviewed the chosen subject, the existing "update your review" notice appears.
- Save and Cancel return to where you came from. Entity return links use stored entity and parent slugs (existing rule).
- `/review` is noindex and needs sign-in.

**Backup switch: exactly how it behaves**
- **One switch for all four flows**, turned on only after all four pass their checks. Before that, the page is reachable only by its direct address, for testing. Switching per flow is rejected because it would split one person's experience across two systems mid-migration.
- **Safe fallback:** if settings can't load, the app uses the new page once it is the default.
- **Rollback:** turning the switch off sends the entry buttons back to the old popup and the old in-timeline form. Direct page addresses keep working.
- **Never affects** who can do what, validation or saving. Those rules live on the server and are the same for both.
- **Retirement:** the old forms and the switch are removed after you approve signed-in testing on desktop and mobile. Target: within two weeks of the page becoming the default. You own that approval, and the roadmap records the date.

**Wording adjustments**
- "No mode checks in the form" means: no scattered business rules based on mode. Mode-specific wording and specialised sections come from the settings table.
- "Saving functions unchanged" means the same server operations, permissions, database meaning and "left alone vs cleared" behaviour. Small typed cleanups at the boundary are allowed.

## Delivery order (each part is checked before the next)

1. **Design gate.** Produce the deliverables below with no behaviour change, then stop for your approval.
2. Pull out the shared pieces: rating, recommendation, written text, photos, locked subject, date, visibility, and the questionnaire.
3. Build the new composer and `ReviewComposerPage`.
4. Move the flows over one at a time, each matching today's behaviour first: create review, edit review, add timeline update, edit timeline update.
5. Make the timeline popup read-only.
6. Turn on the switch so every entry point uses the page. The old forms stay as the rollback.
7. Run the full parity checks, then you test signed in on desktop and mobile.
8. Remove the old forms and the switch after your approval.
9. Later and separately: the storage design for timeline-update answers, then the paused richer-review phases.

## Not in Step 3

- No new popup frame.
- No drafts or autosave, beyond refresh-safe pages and a basic "discard changes?" prompt.
- No extra questions on timeline updates.
- No change to the one-hour rule, latest-only editing, Delete, one review per person, or the post composer.
- No database changes, except possibly the switch (see Technical details).

## Design gate deliverables

- **Current field matrix:** review create/edit vs timeline create/edit, covering fields, required rules, defaults, where each value is saved, and who is allowed.
- **Capability table:** all four modes. Shows the subject as select or locked, rating required or optional, recommendation as initial or timeline-with-reset, wording, media, date, visibility, and questionnaire (hidden in timeline modes).
- **State model:** shared and per-mode values, unsaved-change tracking, upload state, loading saved data, and the expired-window, no-longer-latest, deleted and subject-not-found states.
- **Saving per mode:** the exact data each mode sends, how "left alone" differs from "cleared", how saved metadata is preserved, and the timeline rating-based reset.
- **Page address and return contract:** as listed under "Clarifications", including the `?compose=update` redirect.
- **Timeline answer storage write-up:**
  - Each update records only the answers it changed.
  - The review holds the current answers, and untouched answers carry forward.
  - History shows how answers changed over time.
  - Open questions: edit/undo, versioning, unknown fields, stats, recommendation precedence, older timelines.
- **Migration, rollback and retirement plan.**
- **Parity checklist:** the four flows, the one-hour rule, latest-only editing, media, recommendation resolution, Back/Cancel, refresh, mobile keyboard, and accessibility.

## Technical details

- `resolveComposerMode({ entryType, operation })` maps to `REVIEW_COMPOSER_MODES: Record<ComposerMode, ComposerCapabilities>`. The table covers every mode, and `ReviewComposer` takes no presentation prop.
- **Switch:** add a `reviews.composer_page_enabled` key to the existing `app_config` / `get_public_flags` / `useAppConfig` mechanism.
  - The design gate checks whether `get_public_flags` already exposes new keys.
  - If it does not, extending it is the only database change. It is a small allow-list addition with no data impact, and it gets your approval like any migration.
  - The client reads the switch with the same pattern as the realtime switch: gate on a successful load, otherwise use the defined fallback.
- `/review` receives `{ mode, entityId?, reviewId?, updateId?, returnTo }` via navigation state, following the post composer's pattern. The page loads the review or update by ID from the server, and its loss on refresh is handled as described above. The existing typed own-review lookup and find-or-create entity persistence are reused unchanged. Optional `?entityId=` prefill can match `/create`'s existing parameter if wanted later.
