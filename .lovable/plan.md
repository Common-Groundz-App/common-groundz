# Phase 3C — Ship the questionnaire (implementation)

Phase 3B froze the contracts (recommendation-intent precedence, field ids, stored
values, tag vocabularies in `docs/phase-3b-tag-vocabularies.md`). 3C implements them.
This is the largest phase so far — it touches the database, the review wizard, the
timeline form and the review card — so it ships in **three ordered stages**, each
independently verifiable and safe to stop at.

## Stage 1 — Database foundation and safety

Nothing user-visible changes. One migration:

- Add `review_updates.would_recommend text NULL` with
  `CHECK (would_recommend IN ('yes','maybe','no','auto'))`, plus a partial index on
  `(review_id, created_at DESC, id DESC) WHERE would_recommend IS NOT NULL`.
- **Fix the verified authorization gap** (pre-existing, unsafe to ship intent
  without it): the INSERT policy on `review_updates` only checks
  `auth.uid() = user_id`, never that the referenced review belongs to the user — so
  anyone signed in can already append an update to a stranger's review and move its
  `latest_rating`, `timeline_count`, `trust_score` and `is_recommended`. New policy
  requires the review to be owned by `auth.uid()`, and UPDATE is restricted so
  `review_id`, `user_id`, `created_at` and `would_recommend` cannot be rewritten
  (intent events are immutable — a change of mind is a new row).
- Add the pure SQL resolver: `(metadata, latest timeline intent, effective rating)`
  → `intent`, `source`, `is_recommended`, using
  `ORDER BY created_at DESC, id DESC LIMIT 1` verbatim, and strict envelope
  validation (object, `version = 1`, `type` equals the review's category, `answers`
  object, `would_recommend` exactly `yes`/`maybe`/`no`) — anything else falls back
  to `COALESCE(latest_rating, rating) >= 4`.
- Consolidate the overlapping triggers: keep one review-side recommendation trigger
  that applies resolver output, keep `update_review_timeline_stats_enhanced`, drop
  the older duplicates. Trust-score logic is preserved verbatim.

Verification before and after: snapshot `is_recommended` and `trust_score` for
**every** review (all 77) and assert they are byte-identical, since no review has
explicit intent yet; plus controlled fixtures for initial insert, unrelated edit,
rating edit, timeline insert, and a metadata-only edit. Forgery attempts (append to
someone else's review, rewrite an intent row) must be denied.

## Stage 2 — Questions in the review wizard

- New `CuratedTagSelector` primitive: chip grid with emoji + label, custom entry
  (Plus button and Enter key), 5 combined / max 3 custom / 40 chars, NFC-normalized
  trim then case-insensitive dedupe preserving the user's casing.
- `FoodTagSelector` stays byte-identical and exempt from the new caps — food keeps
  its 13 tags and `metadata.food_tags`.
- New `choice` field kind rendered as a segmented single-select: nothing
  preselected, re-tapping the selected option clears it, so "unanswered" and
  "neutral answer" stay distinct.
- Populate all 15 registry entries with the frozen matrix: every type gets
  `would_recommend` + `stood_out`, plus per-type repeat intent and one extra
  (`value`, `worth_time`, `trust`, `solves_problem`, `portion`, `best_for`) exactly
  as frozen. `legacy_unlinked` gets none of it. All questions optional.
- Persist under `metadata.questionnaire = { version: 1, type, answers }`, merged
  through the existing `mergeReviewMetadata` so provenance and unrelated keys
  survive. Unanswered fields are omitted — never `""`, `null` or `[]`.
- TypeScript resolver mirroring the SQL one, both driven by a single shared fixture
  (the frozen 12-case truth table): Vitest runs it against the TS resolver, a Deno
  harness runs the same cases against the SQL resolver.

## Stage 3 — Intent over time, and cleanup of the dead action

- Timeline update form gains "Would you still recommend it?" showing current state
  and source in words (`Yes — from your last timeline update` /
  `Recommending — inferred from your 4.5 rating`), three unselected options, and a
  "Use rating automatically" action that appends `auto`. Untouched submits omit the
  field and change nothing.
- Divergence nudge only, never inference: when an update drops the effective rating
  below 4 while an explicit `Yes` stands, prompt to revisit — but never change the
  answer automatically.
- If the timeline query fails, say "couldn't resolve your current recommendation"
  rather than claiming a source, while still showing the stored status.
- Retire the "Convert to Recommendation" menu item in `ReviewCard` — verified dead
  (its only write is reverted by the trigger in the same statement, it creates no
  recommendation row, and it never sets `is_converted` so it can't hide itself).
  3C stops reading `is_converted`; 3D decides whether to drop the column.

## Technical notes

- Migration: `review_updates` column + partial index + policies, SQL resolver
  function, trigger consolidation. No changes to reserved schemas.
- Files: `questionnaire/registry.ts` (15 entries + vocabularies),
  `QuestionnaireSections.tsx` (new `choice` and generic `tags` kinds), new
  `CuratedTagSelector.tsx`, new `recommendationIntent.ts` resolver, `ReviewForm.tsx`,
  `steps/StepThree.tsx` / `StepFour.tsx`, `ReviewTimelineViewer.tsx`,
  `services/review/timeline.ts` (intent argument), `ReviewCard.tsx`,
  `ProfileReviews.tsx`.
- `reviews.is_recommended` stays the indexed compatibility signal; no feed query
  starts reading JSONB, and no cached `recommendation_source` column is added.

## Out of scope

Aggregated tag insights on entity pages, analytics on intent, Phase 2.5B legacy
remediation, and any redesign of trust scoring.
