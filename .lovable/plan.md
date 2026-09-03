# Phase 3C (v2) — reviewer corrections folded in

Both reviews are right on every substantive point, and all of them are adopted.
The architecture doesn't change; the delivery boundary, the DB enforcement
mechanism and the vocabulary semantics do. Phase 3B does **not** close until the
vocabulary is corrected, because the tag ids become immutable the moment real
answers exist.

Verified while reviewing: `review_updates` today has owner `UPDATE` **and owner
`DELETE`** policies (`auth.uid() = user_id`), and INSERT only checks
`auth.uid() = user_id` — never review ownership. So "append-only" is not true today
in either direction, and Codex's delete case is real, not hypothetical.

## Stage 0 — close 3B properly (docs only, no code)

1. **Vocabulary semantics.** Bare aspect tags marked `positive` become evaluative
   ids + labels: `compelling_story`, `strong_acting`, `striking_cinematography`,
   `strong_writing`, `memorable_characters`, `engaging_gameplay`, `good_service`,
   `very_clean`, `convenient_location`, `good_value`, `high_quality`,
   `great_packaging`, `strong_ending`, `great_with_friends`, `solid_build`. Anything
   genuinely preference-dependent stays a plain aspect marked `neutral`. Id/label
   mismatches are fixed (`rude_service` → `unhelpful_service`). `best_for` entries
   get explicit `sentiment: 'neutral'` in data rather than a prose note.
2. **The four flagged entries** (I agree with all four): movie `subtitles_needed` →
   `memorable_visuals`; brand `fast_delivery` → `wide_range`; professional
   `missed_deadlines` → `didnt_follow_through` (generalises past deadline-shaped
   professions while staying behaviour-only); experience `good_guide` →
   `well_organised`.
3. **Tag identity is composite**: `(questionnaire type, field id, tag id)`. Nothing
   aggregates across types on string reuse alone; a genuinely shared concept must be
   declared once in a shared-definitions map and referenced.
4. **Food is excluded from generic `stood_out`.** Food Tags *are* food's
   "what stood out" in v1 (`metadata.food_tags`, existing selector). Food gets
   `would_recommend` + `repeat_intent` + `portion` only — never two tag fields, never
   the same selection persisted twice.
5. **Roadmap corrections**: Phase 2.5B is *optional wizard consolidation* (semantic
   step ids, Subject → Review → Publish, rating merged into Review, entity-page flow
   skipping the locked subject stage) — legacy-unlinked remediation is a separate
   deferred item. Phase 3D's scope is restored in full: remove `questionnaireKind`,
   the five-bucket UI branches, obsolete `foodName`/`contentName` state and
   post-versioning compatibility scaffolding; keep only the narrow legacy-unlinked
   adapter; confirm backend category bucketing intact; decide on `is_converted`.
6. **Wording fix**: `FoodTagSelector` must be **regression-identical in behaviour,
   vocabulary, styling and persistence** — not "byte-identical source", which is
   self-contradictory once the file is refactored.

Freeze 3B after this. Then Stage 1 → verify → Stage 2 → verify → Stage 3 → verify.

## Stage 1 — database and resolver foundation (independently deployable)

No new UI is exposed. One migration:

- `review_updates.would_recommend text NULL`,
  `CHECK (would_recommend IN ('yes','maybe','no','auto'))`, partial index on
  `(review_id, created_at DESC, id DESC) WHERE would_recommend IS NOT NULL`.
- **INSERT authorization**: require `auth.uid() = user_id` **and** that
  `review_id` belongs to a review owned by `auth.uid()`. `created_at` stays
  database-assigned.
- **Append-only enforced by a `BEFORE UPDATE`/`BEFORE DELETE` trigger, not by RLS.**
  RLS chooses rows, it cannot compare `OLD` to `NEW`. For v1 ordinary users get no
  mutation of timeline history at all: any `UPDATE` or `DELETE` on `review_updates`
  is rejected with a clear message (an admin/service path may still remove abuse and
  then recomputes review stats). This also removes the stale-cache class of bug
  Codex flagged — an editable or deletable authoritative row would silently
  desynchronise `latest_rating`, `is_recommended` and `trust_score`.
- **Two functions, not one.** A *pure* decision function takes
  `(original envelope, latest intent event, effective rating)` and returns
  `intent | source | is_recommended` with no queries. A separate review-aware
  wrapper owns the deterministic lookup
  (`ORDER BY created_at DESC, id DESC LIMIT 1`) and calls the pure one. The trigger
  calls the wrapper. TypeScript mirrors the same split.
- **Strict envelope extraction**: object, `version = 1`, `type` equals the review's
  canonical `category`, `answers` object, `would_recommend` exactly
  `yes`/`maybe`/`no`; anything else falls back to `COALESCE(latest_rating, rating) >= 4`.
- **Trigger consolidation**: drop both overlapping recommendation triggers on
  `reviews` and the older `update_review_timeline_stats`; keep one recommendation
  trigger applying resolver output and the enhanced timeline-stats trigger. Trust
  scoring is preserved, not redesigned.

Stage 1 acceptance: no existing row changes `is_recommended`, `trust_score`,
`latest_rating` or `timeline_count` (whole-dataset before/after snapshot, all 77
reviews); controlled fixtures for insert, unrelated edit, rating edit, timeline
insert and metadata-only edit; old clients omitting `would_recommend` still insert
successfully; legitimate owner inserts are not blocked; forgery attempts (stranger's
review, rewriting or deleting an intent row) are denied; shared fixture harness
green in both Vitest and the Deno/SQL runner; generated Supabase types regenerated.

## Stage 2 — review questionnaire (UI + persistence)

- Corrected registry vocabularies for the 14 non-food types; `choice` control
  (nothing preselected, re-tap clears); `CuratedTagSelector` (5 combined / max 3
  custom / 40 chars / NFC-trim then case-insensitive dedupe preserving casing);
  `FoodTagSelector` regression-identical and exempt from the caps.
- **Questionnaire-version policy (was missing, now explicit):** new review → v1;
  existing review with a valid v1 envelope → v1; existing review with no
  questionnaire metadata → legacy compatibility, questions shown as an *optional
  addition* and **no envelope written unless the user actually answers something**;
  existing review whose subject is deliberately replaced → fresh v1 for the new
  type. Editing an unrelated field never silently converts a legacy review.
- **Subject-switch reset (new acceptance criterion):** changing the subject's
  canonical type before submit, or in edit mode, discards answers and tag ids that
  don't belong to the new type's vocabulary — movie tag ids must never land in a
  book envelope. Unknown/stale ids encountered on load are dropped from the rendered
  state rather than re-saved.
- Persistence via `metadata.questionnaire = { version: 1, type, answers }` merged
  through `mergeReviewMetadata`; unanswered keys omitted entirely.

Acceptance: all 15 types render their frozen matrix; food shows exactly one tag
field; save/reload round-trips; a legacy review edited without answering stores no
envelope; subject-switch cases covered; a registry lint test asserts every tag id is
unique `snake_case` within its vocabulary and declares a sentiment.

## Stage 3 — timeline intent and dead-action cleanup

Unchanged from v1: "Would you still recommend it?" with resolved current state and
source in words, three unselected options, `auto` reset, untouched = no change,
divergence nudge that never rewrites the answer, honest copy when the resolve query
fails, and removal of the Convert action from both `ReviewCard` layouts plus its
hook/service wiring. `is_converted` is not dropped here — 3D decides.

## Technical notes

- Migration objects: column, check, partial index, INSERT policy replacement,
  append-only guard trigger, pure resolver, review-aware wrapper, consolidated
  triggers.
- Files: `docs/phase-3b-tag-vocabularies.md`, `roadmap.md`,
  `questionnaire/registry.ts`, `QuestionnaireSections.tsx`, new
  `CuratedTagSelector.tsx`, new `recommendationIntent.ts` + shared fixture,
  `ReviewForm.tsx`, `steps/StepThree.tsx`, `steps/StepFour.tsx`,
  `ReviewTimelineViewer.tsx`, `services/review/timeline.ts`, `ReviewCard.tsx`,
  `ProfileReviews.tsx`.
- `reviews.is_recommended` stays the indexed compatibility signal; no cached
  source/intent columns.

## Out of scope

Aggregation of tags on entity pages, intent analytics, trust-score redesign,
Phase 2.5B, dropping `is_converted`.
