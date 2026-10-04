# Step 3 — One shared review composer for reviews and timeline updates

## Which approach, and why

Codex's model is the stronger one, with ChatGPT's presentation idea added. Concretely:

- **Four explicit modes**: `create-review`, `edit-review`, `create-timeline-update`, `edit-timeline-update`. Each mode has its own short settings entry (Codex's "capability configuration") that declares which sections show and which are required.
- **ChatGPT's `presentation: page | modal`**: kept as a separate setting, independent of mode. The form's logic never knows whether it sits on a page or in a popup.
- **Default is page** (your decision, and both reviewers agree it fits a form this long). The current popup form is kept in the app as a selectable backup, so the new page can be tried and compared before anything is removed.

Why this beats one big component with `if (mode === ...)` checks scattered through it: every difference between the four situations lives in one small settings table. Adding a field later means building it once and listing it in the modes that want it — exactly the "change one thing, not two" outcome you asked for.

Why not ChatGPT's `entryType + operation` alone: it describes the same four cases but hides the real differences (rating optional, "what changed" wording, no subject picker) inside the form. Codex's per-mode settings make those differences explicit and reviewable.

## What changes for the user

- "Write a review", "Edit" (within the hour), "Add timeline update" and timeline-update "Edit" all open the new composer **page**, with the subject locked at the top.
- Timeline update stays lightweight by default: what changed (required), optional new rating, "Would you still recommend it?", photos. Extra review questions appear only in an "Update more details" fold, and only for things that actually changed.
- The timeline popup becomes read-only history: AI summary, entries, menus. "Add timeline update" navigates to the page; saving or cancelling returns to the timeline/entity context.
- The existing popup form keeps working until the page proves itself; a settings flag switches between page and popup.

## Unchanged

One review per person per subject, the one-hour Edit rule, latest-only timeline editing, Delete behavior, the post composer, the paused phases. "Base recommendation on rating" stays timeline-only: on a first review, leaving the question unanswered already falls back to the rating.

## The one question to settle before building (temporal ownership)

Timeline updates currently store only rating, comment, recommendation intent and media. Before review questions (pros/cons, best for, food tags) can appear on an update, we must decide where a changed answer lives:

- **Chosen model**: an update records only the answers explicitly changed at that moment; the review row keeps the current effective answers for display and stats; untouched answers carry forward; the timeline can show how answers evolved. This needs a small storage addition on updates later — it is a gate for the advanced fields, not for Step 3's core (rating, recommendation, comment, media), which already have storage.

## Delivery sequence (each part ships and is checked separately)

1. **Design gate (no code changes to behavior)**: produce the exact current Review vs Timeline field matrix, the capability settings for all four modes, the route/return-navigation contract, and the temporal-ownership write-up above. You approve before implementation.
2. **Shared sections**: rating, recommendation intent, comment, media, visibility, questionnaire — extracted as controlled components with one shared form-state hook.
3. **New composer page** (`/review/...` routes, noindex, auth-gated, `requireAuth()` first) mounting the shared sections per mode settings; centered max-width card on desktop.
4. **Cutover with fallback**: a single flag routes entry points to the page (default) or the existing popup (backup). `?compose=update` deep links redirect to the page. Return navigation uses one-time location state per the existing pattern.
5. **Parity verification**: create-review, edit-review, create-update, edit-update behave identically to today (persistence, one-hour enforcement, recommendation reset, media, navigation), verified by tests and preview checks.
6. **Retire or keep**: only after parity passes, decide whether to delete the old popup form or keep it behind the flag.
7. Advanced structured fields on timeline updates wait for the temporal-ownership storage contract (separate approval).

## Technical details

- `reviewComposerModes.ts`: `Record<Mode, ComposerCapabilities>` — typed config (`subject: select|locked|hidden`, `rating: required|optional`, `recommendation: initial|timeline|hidden`, `text: review|what-changed`, `media`, `experienceDate`, `visibility`, `questionnaire: full|updateable|hidden`). No mode checks in JSX; sections render from capabilities.
- Presentation dimension: `page | modal` wrapper only; the composer body is identical in both. Flag lives in one config file.
- Persistence adapters: `createReview`/`updateReview` and `addReviewUpdate`/`editLatestReviewUpdate` unchanged; each mode maps form state to its call. DB triggers/RPCs untouched.
- Routes: `/review/new?entity=<slug>`, `/review/:id/edit`, `/review/:id/update`, `/review/:id/update/edit` (exact URLs reconciled with canonical slug routing in the design gate).
- Tests: mode/capability matrix, recommendation-intent parity with existing ReviewTimelineViewer tests, save mapping per mode, navigation return behavior.
