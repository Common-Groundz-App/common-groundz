# Step 3: One shared review composer (final)

The architecture is now locked. This round added five precise corrections. None of them change direction.

## Final decisions

1. **One composer with configurable steps.**
   - `entryType` (review or timeline update) and `operation` (create or edit) combine into four modes.
   - A settings table holds each mode's sections, required rules, wording and step layout (`steps: SectionId[][]`).
   - Presentation (page or popup) never affects fields, validation, permissions or saving.
   - Today's four-step form is not copied in.
2. **Only the page is built now.** The old popup form and the in-timeline form stay frozen as a temporary rollback.
3. **One route family, one page.** The addresses are listed below.
4. **Timeline updates keep exactly today's fields.** Extra questions wait for the separate storage design.
5. **One switch for all four flows**, using the existing settings system.

## Route family

| Address | Purpose |
|---|---|
| `/review` | New review. The subject is picked on the page, and the address never changes while you pick or create one. |
| `/review?entityId=<id>` | New review from an entity page. The subject is loaded from the database and locked. |
| `/review/:reviewId/edit` | Edit your review |
| `/review/:reviewId/timeline/new` | Add a timeline update |
| `/review/:reviewId/timeline/:updateId/edit` | Edit that exact timeline update |

- `entityId` is only a starting value. It is not a separate mode.
- **Bad starting subject:** if `entityId` is unknown or deleted, a "subject not found" message appears. Choosing "Pick another subject" replaces the address with plain `/review`, so a refresh doesn't bring the error back. From then on, picking stays inside the form.
- Background entity creation works exactly as today.
- Refreshing an unsaved new review started from Home or Profile clears its answers. That is an accepted limit while drafts are out of scope.
- Every `/review` address needs sign-in and is hidden from search engines.

## Checks per mode (enforced on the server; the page only mirrors them)

| Mode | Checks |
|---|---|
| Create review | Signed in. The subject is saved before submit. No existing review by you for that subject: the shared lookup runs, plus the database uniqueness rule. |
| Edit review | The review exists. You own it, or you are an admin checked on the server. It is inside its one-hour window. The subject is locked. |
| Add timeline update | The review exists, you own it, and it can still take updates. There is **no** one-hour limit; adding updates after the hour is the whole point. |
| Edit timeline update | The review and update both exist, you own them, the update belongs to that review, it is still the latest, and it is inside its own one-hour window. |

A failed check shows a clear message ("Edit window closed", "This update is no longer the latest", "Review not found") instead of the form. The page never guesses and never edits a different entry.

## Save and Cancel

| Mode | Save | Cancel |
|---|---|---|
| Create review | The entity page, showing your new review | Where you came from, or Home if unknown |
| Edit review | The entity page | Where you came from, or the entity page |
| Add timeline update | The entity page with the timeline reopened | The entity page with the timeline reopened |
| Edit timeline update | The entity page with the timeline reopened | The entity page with the timeline reopened |

- "Where you came from" is used only if it is a safe address inside the app. Otherwise the page falls back to the entity page, built from the stored entity and parent slugs (existing rule).
- "Timeline reopened" is a one-time marker passed during navigation. It is never put in the address, and the entity page consumes it once, so Back and Forward never reopen the timeline.
- **Old `?compose=update` links** behave as today during the migration. After cutover, if you own a review for that entity, they redirect to `/review/:reviewId/timeline/new`. Otherwise the entity opens normally.

## Backup switch: deterministic fallback

- A fixed **release default** lives in the code:
  - `legacy` until cutover.
  - Changed to `page` in the cutover release.
- A successfully loaded runtime setting can override it, so either way can be switched without a release.
- While loading, or if the setting fails, the release default is used. Nothing has to be guessed.
- **Switch on:** the timeline popup is read-only, and its Add and Edit buttons open the page.
- **Switch off:** the old popup and the in-timeline form work exactly as today.
- The switch never affects permissions, validation, saving, or whether the direct page addresses work. They always work, which is how testing happens before cutover.
- **Retirement:** the old forms, the switch and the release default are removed after you approve signed-in testing. The target is within two weeks of cutover, and the roadmap records the date.

## Section rules (part of the state model)

Every section has the following:
- a stable ID
- validation
- loading and saving mappings
- a visibility rule
- an accessible label linked to its error
- its own unsaved-change tracking

Values live in one central form state, not inside steps. Moving a section between steps, or going Back and Next, never resets a value, an upload, an error or the unsaved-change state.

## Implementation sequence: split into parts, not all at once

Doing it all at once would change four flows in one go. If something broke, we couldn't tell which part caused it, and you couldn't test in between. Each part below ships on its own and gets checked before the next. You see nothing different until part 3D, because the new page is reachable only by its direct address until cutover.

| Part | What gets built or changed | What you'll notice |
|---|---|---|
| **3.0 Design gate** | A written design document with all the deliverables below. No code changes. | Nothing. You review and approve it. |
| **3A Shared foundation** | The shared sections are pulled out of today's forms: rating, recommendation chips with the rating-based reset, written text, photos/video, locked subject, date, visibility, questionnaire. Also the central form state, the mode settings table and the step engine. Today's popup form switches to the shared sections with no visible change. | Nothing should look different. |
| **3B Page + review modes** | The `/review` route family and the `ReviewComposerPage` are added, with create review and edit review working. Their checks, Save/Cancel and safe return are included. | Nothing in normal use. Reachable only by direct address for testing. |
| **3C Timeline modes** | Add timeline update and edit timeline update move onto the page, matching today exactly (rating optional, what changed required, recommendation reset, photos). | Nothing in normal use. Reachable by direct address for testing. |
| **3D Cutover** | The switch is added, with the release default set to `page`. Every Write review, Edit, Add timeline update and timeline Edit button opens the page. The timeline popup becomes read-only while the switch is on. The new `?compose=update` behaviour is added. The full parity checks run on desktop and mobile. | All review writing happens on the new page. You test signed in. |
| **3E Retirement** | After your approval: delete the old popup form, the in-timeline form, the switch and the release default, and update the roadmap. | Nothing; the new page is already what you use. |

Later and separately: the timeline-answer storage design, then the paused richer-review phases, each added once inside the shared composer.

## Not in Step 3

- A new popup frame.
- Drafts or autosave. Only a basic "discard changes?" prompt is included.
- Extra questions on timeline updates.
- Changes to the post composer.
- Changes to server behaviour.
- Database changes, apart from possibly the switch (see Technical details).

## Design gate deliverables (part 3.0)

- **Current field matrix:** review create and edit vs timeline create and edit. It covers fields, required rules, defaults, where each value is saved, and who may change it.
- **Capability and step table:** all four modes.
- **State model:** this includes the section rules above, plus the expired, not-latest, deleted, subject-not-found and bad-starting-subject states.
- **Saving per mode:** the exact data sent, the difference between "left alone" and "cleared", how metadata is preserved, and the timeline rating-based reset.
- **Route, checks and Save/Cancel tables:** as above.
- **Timeline-answer storage write-up:**
  - Updates record only what they change.
  - The review holds the current answers.
  - Untouched answers carry forward.
  - History shows how answers changed.
  - Open questions are listed.
- **Migration, rollback and retirement plan.**
- **Parity checklist:** the four flows, the per-mode checks, media, recommendation resolution, Save and Cancel, refresh, sign-in redirect, mobile keyboard, and accessibility.

## Technical details

- `resolveComposerMode({ entryType, operation })` maps to `REVIEW_COMPOSER_MODES: Record<ComposerMode, ComposerCapabilities>`. Sections come from a registry. Wording comes from the config. There are no scattered business-rule mode checks.
- The route loader resolves `{ entryType, operation, initialEntityId?, reviewId?, updateId? }`, with every ID UUID-validated before any query. Navigation state carries only instant-render display data, a validated internal `returnTo` and the one-time `reopenTimeline` marker.
- Saving keeps the same server operations and meaning: `createReview`, `updateReview`, `addReviewUpdate` and `editLatestReviewUpdate`. Small typed refactors at the boundary are allowed. The own-review lookup and the find-or-create entity persistence are reused unchanged.
- **Switch:** `REVIEW_COMPOSER_RELEASE_DEFAULT` is the code constant. The runtime key `reviews.composer_page_enabled` goes through the existing `app_config` / `get_public_flags` / `useAppConfig` path and is added to the admin `ALLOWED_KEYS`. Only a successful load (`status === 'success'` and not placeholder) overrides the constant. The design gate confirms whether `get_public_flags` already exposes new keys. If it doesn't, a small allow-list extension is the only database change, and it needs your approval.
