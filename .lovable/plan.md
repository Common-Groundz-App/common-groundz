# Phase 3C Stage 3 — timeline intent + retiring Convert

Stage 2 is delivered (registry, curated selectors, envelope persistence via the single
shared save helper, 6/6 end-to-end materialization proof in
`docs/verification/phase-3c-stage2-e2e.md`). Stage 1 carry-overs remain open and stay open —
they are manual-session/concurrency items, not Stage 3 work.

Stage 3 closes the loop: a reviewer adding a timeline update can say whether they *still*
recommend the thing, can undo their newest update, and the stale "Convert to Recommendation"
action goes away.

## What the user will see

1. **"Would you still recommend it?"** in the add-update form of the timeline viewer —
   three chips: Yes / Maybe / No. Nothing is preselected, and leaving it alone means the
   update makes no recommendation statement at all.
2. **A separate "Base recommendation on rating" reset** for the deliberate case of discarding
   an earlier explicit answer and going back to rating inference.
3. **Honest source copy** on the review, so the displayed answer never lies about where it
   came from: an explicit timeline answer reads as the reviewer's latest word, an
   explicit answer on the review itself reads as their original answer, and a
   rating-derived answer is labelled as inferred from the rating.
4. **"Undo latest update"** on the newest timeline entry only, owner only, with neutral
   copy when a newer update has moved the target.
5. **No more "Convert to Recommendation"** menu item anywhere.

## Step 1 — record intent when adding a timeline update (frozen omission semantics)

- Extend `addReviewUpdate` with an optional `wouldRecommend?: 'yes' | 'maybe' | 'no' | 'auto' | null`
  argument written to `review_updates.would_recommend`.
- Three distinct states, exactly as frozen — this is the correction to the previous draft,
  which wrongly collapsed "skipped" into `auto`:
  - **Untouched / cleared / skipped → SQL `NULL`** (column omitted). The update makes no
    recommendation statement; the previous non-null timeline intent stays authoritative.
  - **Yes / Maybe / No → explicit timeline statement.**
  - **"Base recommendation on rating" → `auto`.** Only this deliberate action neutralizes
    earlier explicit intent, resolving to `{ intent: null, source: 'rating_inferred' }`.
    (The label says "rating" because the resolver uses the effective rating —
    `latest_rating` when present, otherwise `rating`.)
- Tapping a selected chip again clears back to unanswered → `NULL`. It must never become `auto`.
- The column is already nullable and the SQL ordering function already filters nulls out, so
  no migration is needed.
- The client never writes `reviews.is_recommended`. Materialization stays with the Stage 1
  DB path (`review_updates_after_insert` → `recompute_review_timeline_state`).

## Step 2 — the question in the timeline viewer

- Reuse the existing `ChoiceChips` renderer from the questionnaire (same unanswered/answered
  semantics, same tap-to-clear) inside `ReviewTimelineViewer`'s add-update form, directly
  under the rating control, with the three explicit options only.
- The reset is a distinct, clearly labelled control next to the chips — not a fourth chip —
  because it means something categorically different from an answer. Choosing it deselects any
  chip; choosing a chip clears the reset.
- Options, labels and reset copy live in one exported constant next to the resolver types, so
  the wording has a single source and cannot drift from the stored values.
- Existing behaviour of the form is otherwise untouched: comment still required, rating still
  optional, media flow unchanged.

## Step 3 — honest source copy

- Add a small pure presentation helper that maps a resolved
  `{ intent, source }` pair to display copy, driven by the frozen
  `timeline_explicit | review_explicit | rating_inferred` contract.
- Read the answer through the existing `resolveRecommendationForReview` wrapper (the TS mirror
  of the SQL resolver) — never by re-deriving a rule locally, and never by trusting a
  hand-written threshold.
- **No N+1.** Source copy is shown only on surfaces that already hold the review's timeline
  events (the timeline viewer / review detail). No per-card timeline query is added to feeds or
  profile grids; those surfaces keep their existing recommendation display untouched until the
  data can be supplied by an existing efficient query.
- **Failure-aware and completeness-aware.** The helper takes an explicit provenance-knowledge
  flag, not a "did something load" boolean. It may claim a source only when the caller has
  authoritative knowledge of the latest non-null timeline intent — meaning the caller holds the
  review's *complete* timeline history, or was given that latest intent event separately.
  A partial page is not enough: twenty loaded `NULL` rows do not overrule an unloaded older
  `no`, and treating them as such would print a confident lie.
  When the fetch failed, is still loading, or is known-partial, the UI renders the
  DB-materialized `is_recommended` with no provenance claim at all.
  Today `fetchReviewUpdates` selects every row for the review with no range or limit, so the
  viewer's data is complete — the flag is set from that fact explicitly (and a test asserts the
  fetch is unpaginated), so that adding pagination later fails loudly instead of silently
  degrading the copy into a lie.
- Per-entry display inside the viewer is literal, not resolved: `yes|maybe|no` show the recorded
  answer, `auto` shows the reset wording, and `NULL` shows nothing — a null row must never look
  like it made a statement.

## Step 4 — undo latest update

- New service call wrapping the Stage 1 RPC
  `delete_latest_review_update(p_review_id, p_expected_update_id)`, which is already granted
  to `authenticated` and enforces ownership, takes the per-review advisory lock, and returns
  one of three statuses.
- Map statuses to UX: `deleted` → success + refetch; `conflict` → neutral copy, "A newer
  update exists, so this one can no longer be undone" + refetch (the RPC also returns the real
  newest id); `not_found` → the entry is already gone + refetch. No wording implies another
  person added the newer entry — timeline INSERT is owner-scoped.
- The action appears only on the newest entry, only for the review owner, and only through
  `requireAuth()` as the first statement of the handler. Confirmation dialog before firing.
- All three outcomes also refresh the parent review, not just the entry list: the RPC calls
  `recompute_review_timeline_state`, so `is_recommended`, `latest_rating`, `timeline_count`,
  `has_timeline` and `trust_score` can all have changed.
- Nothing else may delete timeline entries: no direct client `DELETE` is added, matching the
  Stage 1 privilege posture.

## Step 5 — retire Convert

- Remove the `onConvert` prop and both menu items from `ReviewCard`, the
  `convertToRecommendation` handler in `use-reviews`, the wiring in `ProfileReviews`, and the
  `convertReviewToRecommendation` functions in both `services/review/core.ts` and
  `services/reviewService.ts`.
- Verified reason to remove rather than keep: that code path writes
  `reviews.is_recommended = true` directly, and the `reviews_apply_recommendation` BEFORE
  INSERT OR UPDATE trigger recomputes and overwrites that column on every write. The action
  is therefore already a silent no-op that shows a success toast — it misleads users today.
- `reviews.is_converted` is **not** touched here; auditing that column stays a Phase 3D item.

## Tests and verification

- Unit tests for the new intent option constant (values match the DB check constraint's
  allowed set) and for the source-copy helper across all three sources, the `intent: null`
  case, the failed/loading state, and the known-partial state (both: no provenance claim).
- Payload tests for the three states: chip selected → that value; question skipped → column
  omitted / `NULL`; chip selected then tapped again → omitted / `NULL`; reset action → `auto`.
- Regression coverage for the corrected precedence, driven through the existing resolver:
  `no` then `NULL` still resolves `no` / `timeline_explicit`; `no` then `auto` resolves
  `intent: null` / `rating_inferred`.
- Per-entry display test: `NULL` renders no recommendation statement, `auto` renders the reset
  wording.
- A test asserting `fetchReviewUpdates` issues no `range`/`limit`, so the completeness flag the
  source copy relies on stays true.
- Undo status mapping tested for all three RPC statuses, including that a `conflict` triggers
  a refetch and no optimistic removal, and that the parent review is refreshed in all three.
- Full Vitest run plus a build check.
- Explicitly reported as UNVERIFIED, not substituted: the browser → supabase-js → RLS hop
  (external Supabase, no obtainable test session) and the Stage 1 concurrency/real-session
  carry-overs. Unit and build results are never described as covering them.

## Technical notes

- `review_updates.would_recommend` allows `yes | maybe | no | auto` and is nullable; `NULL`
  means "this update made no recommendation statement" and the SQL ordering function filters
  those rows out. No migration is required for Stage 3.
- Ordering for "latest" and "newest entry" is `created_at DESC, id DESC` everywhere — the same
  ordering the SQL function, the TS mirror, and the undo RPC use.
- `created_at` is server-owned (client value overwritten by the BEFORE INSERT trigger), so the
  UI must refetch after insert rather than trusting a locally constructed row.
- `roadmap.md` is updated at implementation time: the Stage 3 line is reworded to the corrected
  semantics (explicit reset action, not a skipped question), and items are ticked only for what
  the tests above actually prove.

## Stop point

Implement Stage 3 only, then stop before Phase 3D. The report will list: files and identifiers
changed; the final `addReviewUpdate` signature and payload behaviour; evidence that skipped and
cleared answers omit the column and that only the reset sends `auto`; source-copy tests
including unavailable and partial data; per-entry `NULL`/`auto` display tests; undo status,
refetch and parent-review-refresh tests; every removed Convert identifier plus confirmation no
call sites remain; full Vitest and build results; the remaining UNVERIFIED integration and
concurrency items; and confirmation that Phase 3D was not started.
