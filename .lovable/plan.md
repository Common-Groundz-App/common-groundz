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
   four options: Yes / Maybe / No / Not sure yet. Nothing is preselected.
2. **Honest source copy** on the review, so the displayed answer never lies about where it
   came from: an explicit timeline answer reads as the reviewer's latest word, an
   explicit answer on the review itself reads as their original answer, and a
   rating-derived answer is labelled as inferred from the rating.
3. **"Undo latest update"** on the newest timeline entry only, owner only, with a clear
   message when someone else's newer entry (or a concurrent undo) has moved the target.
4. **No more "Convert to Recommendation"** menu item anywhere.

## Step 1 — record intent when adding a timeline update

- Extend `addReviewUpdate` with an explicit `wouldRecommend` argument typed as
  `'yes' | 'maybe' | 'no' | 'auto'`, written straight to `review_updates.would_recommend`.
- "Not sure yet" writes `auto`. This is the reset: `auto` is stored as historical event data
  and the frozen resolver contract turns a latest `auto` into
  `{ intent: null, source: 'rating_inferred' }`, i.e. the review falls back to its rating.
- Omitting the question entirely also writes `auto`, so every update carries an explicit
  event value and there is no null-vs-auto ambiguity in new rows.
- The client never writes `reviews.is_recommended`. Materialization stays with the Stage 1
  DB path (`review_updates_after_insert` → `recompute_review_timeline_state`).

## Step 2 — the question in the timeline viewer

- Reuse the existing `ChoiceChips` renderer from the questionnaire (same unanswered/answered
  semantics, same tap-to-clear) inside `ReviewTimelineViewer`'s add-update form, directly
  under the rating control.
- The four options and their labels live in one exported constant next to the resolver types,
  so the copy has a single source and cannot drift from the stored values.
- Existing behaviour of the form is otherwise untouched: comment still required, rating still
  optional, media flow unchanged.

## Step 3 — honest source copy

- Add a small pure presentation helper that maps a resolved
  `{ intent, source }` pair to display copy, driven by the frozen
  `timeline_explicit | review_explicit | rating_inferred` contract.
- Read the answer through the existing `resolveRecommendationForReview` wrapper (the TS mirror
  of the SQL resolver) — never by re-deriving a rule locally, and never by trusting a
  hand-written threshold.
- Show it where a review already displays its recommendation state, and show each timeline
  entry's own recorded answer inside the viewer.

## Step 4 — undo latest update

- New service call wrapping the Stage 1 RPC
  `delete_latest_review_update(p_review_id, p_expected_update_id)`, which is already granted
  to `authenticated` and enforces ownership, takes the per-review advisory lock, and returns
  one of three statuses.
- Map statuses to UX: `deleted` → success + refetch; `conflict` → "this is no longer the
  newest update" + refetch (the RPC also returns the real newest id); `not_found` → the
  entry is already gone + refetch.
- The action appears only on the newest entry, only for the review owner, and only through
  `requireAuth()` as the first statement of the handler. Confirmation dialog before firing.
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
  allowed set) and for the source-copy helper across all three sources plus the
  `intent: null` case.
- A test asserting "not sure yet" and "question skipped" both send `auto`.
- Undo status mapping tested for all three RPC statuses, including that a `conflict` triggers
  a refetch and no optimistic removal.
- Full Vitest run plus a build check.
- Explicitly reported as UNVERIFIED, not substituted: the browser → supabase-js → RLS hop
  (external Supabase, no obtainable test session) and the Stage 1 concurrency/real-session
  carry-overs.

## Technical notes

- `review_updates.would_recommend` allows `yes | maybe | no | auto` and is nullable; existing
  rows stay null and keep resolving through the ordering function, which filters nulls out.
- Ordering for "latest" and "newest entry" is `created_at DESC, id DESC` everywhere — the same
  ordering the SQL function, the TS mirror, and the undo RPC use.
- `created_at` is server-owned (client value overwritten by the BEFORE INSERT trigger), so the
  UI must refetch after insert rather than trusting a locally constructed row.
- Roadmap: Stage 3 items get ticked only for what the tests above actually prove.

## Stop point

Implement Stage 3 only. Report the changes and every verification result separately, naming
any check that could not be executed, then stop for review before Phase 3D.
