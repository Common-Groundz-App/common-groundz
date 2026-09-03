# Phase 3C (v3) — reviewer corrections + LIFO timeline deletion

All six corrections (ChatGPT's two, Codex's four) are adopted; they close real
data-integrity gaps and none of them changes the architecture. Delivery stays
Stage 0 → verify → Stage 1 → verify → Stage 2 → verify → Stage 3 → verify.

**Verified before writing this:** across the whole `src/` tree, `review_updates`
is only ever **selected** and **inserted** — there is no edit or delete path in
any user or admin surface (the delete control on `TimelineReviewCard` deletes the
parent *review*, not an update). So append-only is not an accidental product
change; it is the behaviour that already ships. The DB policies were simply wider
than the product.

**On your LIFO idea — yes, and it's better than plain immutability.** Append-only
history is right, but "I fat-fingered my last update" is a real need, and
last-in-first-out undo satisfies it without letting anyone rewrite the middle of a
narrative. It is also cheap to enforce honestly: deleting only the newest row means
the recomputed `latest_rating` / latest intent / `timeline_count` / `trust_score`
are always the state that existed one step earlier, so there is no reconstruction
guesswork. Adopted as the product contract:

- Owner may delete **only the newest** update on their own review; deleting the 3rd
  of 5 requires deleting the 5th, then the 4th.
- No `UPDATE` on `review_updates` for anyone but the privileged path — a changed
  opinion is a new event, not a rewritten one.
- Deleting a row that carried recommendation intent (including an `auto` reset)
  restores whatever intent the previous state resolved to. That is the correct
  meaning of undo.
- Stage 1 adds the DB rule; the *UI* affordance (delete on the last entry only)
  ships in Stage 3 with the rest of the timeline work.

## Roadmap additions (Stage 0 writes these)

- Timeline history is append-only with owner LIFO undo of the newest entry.
- Forward-compatibility contract: unknown questionnaire data is never rendered and
  never destroyed by unrelated saves.
- Legacy category-mismatch reviews stay in compatibility mode until the subject is
  deliberately reselected.

## Stage 0 — close 3B properly (docs only, no code)

1. **Rewrite `docs/phase-3b-tag-vocabularies.md`** — the shipped file still contains
   `story`, `acting`, `writing`, `gameplay` marked `positive`. Codex is right that
   Stage 2 must not consume it verbatim. Bare aspects marked positive become
   evaluative: `compelling_story`, `strong_acting`, `striking_cinematography`,
   `strong_writing`, `memorable_characters`, `engaging_gameplay`, `good_service`,
   `very_clean`, `convenient_location`, `good_value`, `high_quality`,
   `great_packaging`, `strong_ending`, `great_with_friends`, `solid_build`.
   Preference-dependent traits (slow burn, crowded, challenging, fast paced) stay
   plain aspects marked `neutral`. `rude_service` → `unhelpful_service`. `best_for`
   entries carry explicit `sentiment: 'neutral'` in data.
2. **The four flagged entries**: movie `subtitles_needed` → `memorable_visuals`;
   brand `fast_delivery` → `wide_range`; professional `missed_deadlines` →
   `didnt_follow_through`; experience `good_guide` → `well_organised`.
3. **Tag identity is composite** — `(type, field id, tag id)`. Cross-type
   aggregation requires an explicit shared-definitions map, never string reuse.
4. **Food is excluded from generic `stood_out`.** Food = `would_recommend` +
   `repeat_intent` + existing Food Tags (`metadata.food_tags`) + `portion`. Never
   two tag fields on one food review.
5. Roadmap corrections: Phase 2.5B is *optional wizard consolidation*; Phase 3D's
   full cleanup scope restored (`questionnaireKind`, five-bucket branches, obsolete
   `foodName`/`contentName` state, versioning scaffolding, `is_converted` decision).
6. `FoodTagSelector` is **regression-identical in behaviour, vocabulary, styling and
   persistence** — not "byte-identical source".

Freeze tag ids only after this file is corrected and the lint test passes.

## Stage 1 — database and resolver foundation

One migration, no new UI:

- `review_updates.would_recommend text NULL`,
  `CHECK (would_recommend IN ('yes','maybe','no','auto'))`, partial index on
  `(review_id, created_at DESC, id DESC) WHERE would_recommend IS NOT NULL`.
- **INSERT authorization**: authenticated **and** `user_id = auth.uid()` **and** the
  parent `review_id` belongs to a review owned by `auth.uid()`.
- **Server-owned chronology (Codex #4a):** "database-assigned" is not enough while
  clients can send a value. A `BEFORE INSERT` trigger **overwrites**
  `created_at`/`updated_at` with `now()` unconditionally, so callers cannot
  backdate an event to outrank the true latest one.
- **Append-only + LIFO undo, enforced in a trigger** (RLS picks rows, it cannot
  compare OLD/NEW):
  - `BEFORE UPDATE` — rejected for non-privileged callers, always.
  - `BEFORE DELETE` — allowed only when the row is the newest for its
    `review_id` (`ORDER BY created_at DESC, id DESC LIMIT 1`), evaluated inside the
    statement's transaction. Otherwise a clear "only your latest update can be
    removed" error.
  - **Privileged bypass is defined precisely (Codex #4b):** bypass is granted by
    `current_user`/role membership (`service_role`, or a `postgres`-owned
    maintenance function) — never by caller-supplied metadata, a session GUC set by
    the client, or a row column.
  - **Every** deletion — LIFO or privileged — recomputes `latest_rating`,
    `timeline_count`, `has_timeline`, `trust_score` and the resolved
    `is_recommended` **in the same transaction**, via one shared recompute function
    that both paths call.
- **Two functions, not one:** a *pure* decision function
  `(original envelope, latest intent event, effective rating) → intent | source |
  is_recommended` with no queries, plus a review-aware wrapper owning the
  deterministic lookup. The trigger calls the wrapper. TypeScript mirrors the split
  (`lookupLatestRecommendationIntent(reviewId)` → pure resolver).
- **Strict envelope extraction**: object, `version = 1`, `type` equals the review's
  canonical `category`, `answers` object, `would_recommend` exactly
  `yes`/`maybe`/`no`; anything else → `COALESCE(latest_rating, rating) >= 4`.
- **Trigger consolidation**: drop both overlapping recommendation triggers and the
  older timeline-stats trigger; keep one recommendation trigger plus the enhanced
  timeline-stats trigger. Trust scoring preserved, not redesigned.

Acceptance: whole-dataset before/after snapshot of all 77 reviews shows zero drift
in `is_recommended`, `trust_score`, `latest_rating`, `timeline_count`; fixtures for
insert / unrelated edit / rating edit / timeline insert / metadata-only edit; old
clients omitting `would_recommend` still insert; legitimate owner inserts pass;
stranger inserts, backdated `created_at`, any `UPDATE`, and mid-history `DELETE` are
all denied; newest-row delete succeeds and rolls stats back exactly one step;
privileged mid-history delete recomputes correctly; shared fixture green in both
Vitest and the SQL/Deno runner; Supabase types regenerated.

## Stage 2 — review questionnaire (UI + persistence)

- Corrected vocabularies for the 14 non-food types; `choice` control (nothing
  preselected, re-tap clears); `CuratedTagSelector` (5 combined / max 3 custom / 40
  chars / NFC-trim then case-insensitive dedupe preserving casing); Food Tags
  untouched and exempt from the caps.
- **Version-selection policy:** new review → v1; existing review with a valid v1
  envelope → v1; existing review with no envelope → compatibility mode, questions
  offered as optional and **no envelope written unless the user actually answers
  something**; subject deliberately replaced → fresh v1 for the new subject.
- **Legacy category mismatch (Codex #1):** where `reviews.category` disagrees with
  the linked entity's canonical type (e.g. `category = food`, entity `place`), an
  envelope built from the entity type would be permanently ignored by strict
  validation (`place !== food`). Such reviews therefore **stay in compatibility mode
  and are not offered v1 questions at all**; they become eligible only when the user
  deliberately reselects the subject, which canonicalises `category`. Answering one
  optional field never silently rewrites `category`.
- **Reset boundary is `entity_id`, not canonical type (Codex #2):** answers describe
  a specific subject, so replacing Movie A with Movie B discards the envelope even
  though the vocabulary is identical. Same for product→product, food→food,
  place→place, brand→brand, professional→professional. `metadata.food_tags` is
  cleared on a food-subject swap too.
- **Render-vs-persist separation (both reviewers):** the form never renders what it
  doesn't understand, and never destroys it either.

  | Stored state | Behaviour |
  |---|---|
  | Unsupported `version` | Preserve the whole envelope untouched; render nothing, edit nothing |
  | Valid v1, unknown field key | Don't render; preserve on unrelated save |
  | Valid v1, unknown tag id | Don't render as a selected chip; preserve on unrelated save |
  | User edits that specific field | Rewrite **only** that field with sanitized current values |
  | Subject entity replaced | Discard the old envelope, initialise a clean one |
  | Corrupt / non-object envelope | Preserve raw metadata unless subject replacement initialises a clean envelope |

  Saves patch owned fields into the existing `answers` object rather than replacing
  it, on top of `mergeReviewMetadata`.

Acceptance: all 15 types render their frozen matrix; food shows exactly one tag
field; round-trip save/reload; forward-compatibility tests proving
`some_future_field` and `some_future_tag` survive an unrelated headline edit and
survive an edit to a *different* questionnaire field; legacy review edited without
answering stores no envelope; mismatched-category review is offered no questions;
subject swap within the same type clears answers and food tags; registry lint test
asserts unique `snake_case` ids with declared sentiment per vocabulary.

## Stage 3 — timeline intent, LIFO delete UI, dead-action cleanup

"Would you still recommend it?" with the resolved current state and its source in
plain words, three unselected options, "Use my rating instead" (`auto`), untouched =
no change, divergence nudge that never rewrites the answer, honest copy when the
resolve query fails. Adds the **delete control on the newest timeline entry only**,
with copy explaining the LIFO rule, plus removal of the Convert action from both
`ReviewCard` layouts and its hook/service wiring. `is_converted` is decided in 3D.

## Technical notes

- Migration objects: column, check, partial index, INSERT policy replacement,
  chronology trigger, append-only/LIFO guard trigger, shared recompute function,
  pure resolver, review-aware wrapper, consolidated triggers.
- Files: `docs/phase-3b-tag-vocabularies.md`, `roadmap.md`,
  `questionnaire/registry.ts`, `QuestionnaireSections.tsx`, new
  `CuratedTagSelector.tsx`, new `recommendationIntent.ts` + shared fixture,
  `ReviewForm.tsx`, `steps/StepThree.tsx`, `steps/StepFour.tsx`,
  `ReviewTimelineViewer.tsx`, `services/review/timeline.ts`,
  `services/reviewService.ts`, `ReviewCard.tsx`, `ProfileReviews.tsx`.
- `reviews.is_recommended` stays the indexed compatibility signal; no cached
  intent/source columns.

## Out of scope

Entity-page tag aggregation, intent analytics, trust-score redesign, Phase 2.5B,
dropping `is_converted`, editing timeline text after posting.
