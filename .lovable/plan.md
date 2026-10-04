# Step 3 — One shared review composer (final, design gate first)

## Final decisions and why

1. **Three independent settings and one settings table.**
   - `entryType` (review or timeline update) and `operation` (create or edit) combine into one of four modes.
   - A settings table, keyed by mode, holds all of the business behaviour: which sections show, which are required, the wording, and which step each section belongs to.
   - Presentation (page or popup) belongs only to the outer frame. It never affects fields, validation, permissions or saving.
   - Why: every difference lives in one place.

2. **Steps are configurable, not today's wizard copied.**
   - The composer is built from shared sections, a section list, the settings table, and a step layout taken from that table.
   - It is not today's fixed four-step form wrapped in a new name.
   - Why: the richer review phases will reorder and add sections. Doing that later should mean editing configuration, not another rewrite.

3. **The page is built now, with a temporary backup.**
   - Only `ReviewComposerPage` is built.
   - The old popup form and the old in-timeline form stay frozen as the rollback.
   - A new popup frame is built later only if needed. It would hold the same composer.

4. **One route family, one page, one composer** (details below).
   - Creating a review uses `/review`, which never changes while you pick or create a subject.
   - Saved reviews and updates get short addresses that carry their ID.

5. **Timeline updates keep today's fields during the move.**
   - What changed, an optional rating, "Would you still recommend it?" with its rating-based reset, and photos.
   - Extra questions wait for a separate storage design.

6. **The backup switch uses the app's existing settings system.** No new switch system is built.

## Route family

All five addresses open the same page and composer.

| Address | Purpose |
|---|---|
| `/review` | New review from Home or Profile. Pick the subject on the page. |
| `/review?entityId=<id>` | New review from an entity page. The subject is loaded from the database and locked. |
| `/review/:reviewId/edit` | Edit your review. |
| `/review/:reviewId/timeline/new` | Add a timeline update. |
| `/review/:reviewId/timeline/:updateId/edit` | Edit that exact timeline update. |

**Creating a review**
- `entityId` is only a starting value. It is not a separate mode and has no effect on saving.
  - A valid ID loads the subject and locks it.
  - No ID shows the normal subject picker.
  - An unknown or deleted ID shows "subject not found" with a way to pick again.
- Selecting, changing, clearing or creating a subject in the background never rewrites the address.
- Background creation works exactly as today: find or create the subject, keep its real ID in the form, then run the existing-review check.
- Refreshing a new review that was started from Home or Profile clears unsaved answers. This is an accepted limit while drafts are out of scope.

**Existing reviews**
- These addresses carry IDs so a refresh, a sign-in redirect or an old tab reloads the exact record.
- The server always re-checks four things: ownership, the one-hour window, that the update belongs to that review, and that it is still the latest. If a check fails, a clear message replaces the form ("Edit window closed", "This update is no longer the latest"). It never guesses or edits a different entry.
- "Timeline" in the address matches the product wording. `/edit` corrects the review; `/timeline/...` is about timeline entries.

**Return after Save or Cancel**
1. Passed return info is used only if it is a safe address inside the app. Anything else is ignored.
2. Otherwise the page returns to the review's entity page, built from the stored entity and parent slugs (existing rule).
3. After a timeline save, a one-time marker reopens the timeline. The entity page consumes it, so Back and Forward never reopen it.

**Old `?compose=update` links**
- During the migration they behave as today.
- After cutover, if you own a review for that entity, the link redirects to `/review/:reviewId/timeline/new`. Otherwise the entity opens normally and nothing is guessed. The existing ID-to-readable entity redirect is kept.

**Sign-in and search:** every `/review` address needs sign-in and is noindex.

## Backup switch

- **One switch for all four flows.** It turns on only after all four flows pass their checks. Until then, the page is reachable only by its direct address, for testing.
- **Switch on:** the timeline popup is read-only, and its Add and Edit buttons open the page.
- **Switch off:** the old popup form and the old in-timeline form work exactly as today.
- The in-timeline form is permanently deleted only when the switch itself is retired.
- **Safe fallback:** if the setting can't load, the app uses whichever option is the current default.
- The switch never changes permissions, validation or saving.
- **Retirement:** the old forms and the switch are removed after you approve signed-in testing on desktop and mobile. The target is within two weeks of the page becoming the default, and the date is recorded in the roadmap.

## Delivery order (each part is checked before the next)

1. **Design gate:** produce the deliverables below, with no behaviour change, then stop for your approval.
2. Pull out the shared sections: rating, recommendation, written text, photos, locked subject, date, visibility and questionnaire.
3. Build the composer (section list, settings table, step layout) and `ReviewComposerPage`.
4. Move the flows one at a time, each matching today's behaviour first: create review, edit review, add timeline update, edit timeline update.
5. Turn on the switch for all entry points. The timeline popup becomes read-only while the switch is on.
6. Run the full parity checks, then you test signed in on desktop and mobile.
7. After your approval, remove the old forms and the switch.
8. Later and separately: the storage design for timeline-update answers, then the paused richer-review phases.

## Not in Step 3

- No new popup frame.
- No drafts or autosave beyond a basic "discard changes?" prompt.
- No extra questions on timeline updates.
- No database changes, except possibly the switch (see Technical details).
- No change to the one-hour rule, latest-only editing, Delete, one review per person, or the post composer.

## Design gate deliverables

- **Current field matrix:** review create and edit vs timeline create and edit. Covers fields, required rules, defaults, where each value is saved, and who may change it.
- **Capability table:** all four modes, including the step layout per mode, the subject shown as a picker or locked, rating required or optional, the recommendation type, wording, media, date, visibility, and questionnaire (hidden in the timeline modes).
- **State model:** shared and per-mode values, unsaved-change tracking, upload state, loading saved data, and the expired, no-longer-latest, deleted and subject-not-found states.
- **Saving per mode:** the exact data each mode sends, the difference between "left alone" and "cleared", how saved metadata is preserved, and the timeline rating-based reset.
- **Route and return contract:** as above, including the post-cutover `?compose=update` behaviour.
- **Timeline answer storage write-up:**
  - Updates record only the answers they change.
  - The review holds the current answers.
  - Untouched answers carry forward.
  - History shows how answers changed.
  - It lists the open questions.
- **Migration, rollback and retirement plan.**
- **Parity checklist:** the four flows, the one-hour rule, latest-only editing, media, recommendation resolution, Back and Cancel, refresh, sign-in redirect, mobile keyboard, and accessibility.

## Technical details

- `resolveComposerMode({ entryType, operation })` maps into `REVIEW_COMPOSER_MODES: Record<ComposerMode, ComposerCapabilities>`. The table includes `steps: SectionId[][]`.
  - Sections come from a registry and render from capabilities.
  - Mode-specific wording comes from config.
  - There are no scattered business-rule mode checks.
- The route loader resolves `{ entryType, operation, initialEntityId?, reviewId?, updateId? }`, validating UUIDs before any query.
  - Navigation state carries only display data for an instant first render, a validated internal `returnTo`, and the one-time `reopenTimeline` marker.
- Saving keeps the same server operations and semantics: `createReview`, `updateReview`, `addReviewUpdate`, `editLatestReviewUpdate`. Small typed boundary refactors are allowed.
- The existing typed own-review lookup and find-or-create entity persistence are reused unchanged.
- **Switch:** a `reviews.composer_page_enabled` key in the existing `app_config` / `get_public_flags` / `useAppConfig` mechanism.
  - The design gate checks whether `get_public_flags` already exposes new keys. If it doesn't, a small allow-list extension is the only database change, and it needs your approval.
  - The client reads the switch the same way as the realtime switch: only a successful load counts, otherwise the defined fallback is used.
