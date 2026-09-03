# Phase 3B — Questionnaire specification (v4: recommendation intent frozen)

Both reviews converge except on one point, and I've adjudicated it below.
**No UI code and no migration ship in 3B.**

## Verified current behaviour

`reviews.is_recommended` is fully derived. Two `BEFORE INSERT OR UPDATE` triggers
on `reviews` recompute it on every write — `trigger_auto_recommend_review`
(`rating >= 4`) and `auto_recommend_review_timeline_aware_trigger`
(`COALESCE(latest_rating, rating) >= 4`) — and both also recompute `trust_score`.
Two triggers on `review_updates` overlap too: `update_review_timeline_stats`
(count + trust) and `update_review_timeline_stats_enhanced` (count +
`latest_rating` + trust, then a second no-op UPDATE purely to force recommendation
re-evaluation).

Data: 77 reviews, 58 recommended, **0** rows disagreeing with effective
rating ≥ 4 in either direction.

**Convert to Recommendation** is the upload-cloud dropdown item in
`ReviewCard.tsx` (lines 320, 561), in the "..." menu, rendered only when you're on
your own profile's Reviews tab, own the review, `ProfileReviews` passed
`onConvert`, and `is_converted` is false. It writes only `is_recommended: true` —
reverted by the trigger in the same UPDATE — creates no `recommendations` row, and
never sets `is_converted`, so it can't hide. Retired in 3C.

## Recommendation-intent precedence (frozen)

```text
1. latest timeline intent event (review_updates.would_recommend, newest by created_at)
     yes | maybe | no  -> AUTHORITATIVE
     auto              -> discard all earlier explicit intent, use rating
2. original questionnaire answer (valid envelope only) -> AUTHORITATIVE
3. COALESCE(latest_rating, rating) >= 4                -> INFERRED FALLBACK
```

Flag mapping: `yes` → `true`; `maybe` → `false`; `no` → `false`. `maybe` keeps its
nuance in the stored answer; the boolean means "would actively recommend".

Rating answers "how good was it"; recommending answers "should someone else choose
it". 3 stars/"yes, great for beginners" and 4 stars/"maybe, far too expensive" are
both real and currently unrepresentable. The rating rule staying as the fallback is
what keeps recommendation counts intact on launch day — every question is optional
and all 77 existing reviews have no answer.

`reviews.is_recommended` remains the indexed compatibility signal for its 6 service
consumers, 2 RPCs and the smart-assistant function. No feed query starts reading
JSONB.

### Adjudicated: no cached source columns in v1 (ChatGPT's position)

Codex proposed caching `recommendation_intent` + `recommendation_source`. Declined
for v1: that is two more columns to keep synchronized against metadata edits,
timeline inserts, subject/category changes and future questionnaire versions, and
**no current query filters or groups by source**. `is_recommended` earns its
persistence because real feed queries filter on it; source does not yet.

Codex's *precision* point is adopted as resolver output instead of storage —
`explicit | inferred` is too coarse for the UI copy we need:

```text
resolveRecommendationIntent(review, timelineIntentEvents) -> {
  intent:        'yes' | 'maybe' | 'no' | null,   // null = never stated
  isRecommended: boolean,
  source:        'timeline_explicit' | 'review_explicit' | 'rating_inferred',
}
```

A deliberate `auto` reset resolves to `rating_inferred`; the reset event itself
stays in `review_updates`, so the distinction is recoverable without a column.
Revisit persisting a source column only when a real query needs it.

UI honesty rule: if the timeline query fails, the form must **not** claim the state
came from the original answer or the rating. Show "couldn't resolve your current
recommendation" while still rendering the materialized `is_recommended` status.

## Timeline evolution of intent

`review_updates` gains `would_recommend text NULL` with
`CHECK (would_recommend IN ('yes','maybe','no','auto'))` — a real column, mirroring
how `review_updates.rating` already works. Plus a partial index on
`(review_id, created_at DESC, id DESC) WHERE would_recommend IS NOT NULL`.

### "Latest" has exactly one definition

`ORDER BY created_at DESC, id DESC LIMIT 1`, used verbatim in the SQL resolver, the
TypeScript resolver, the fixture cases and the timeline UI. `id` is only a
tie-breaker for identical timestamps, never a chronology claim.

Chronology must not be client-controllable, or precedence becomes forgeable:
`created_at` is assigned by the database default and clients cannot supply or
change it, and intent-bearing timeline rows are immutable — a change of mind is a
new event, never an edit of an old one. The current UPDATE policy on
`review_updates` (`auth.uid() = user_id`, no column restriction) would let an owner
rewrite `created_at` and reorder their own intent history; 3C closes that.

Event semantics, frozen:

| Latest timeline event | Result |
|---|---|
| `yes` | explicitly recommending |
| `maybe` | explicit, not counted as recommending |
| `no` | explicitly not recommending |
| `auto` | earlier explicit intent discarded; effective rating decides |
| no intent value on this update | current resolved intent and source preserved |

Because timeline events are strictly newer than the original answer, an `auto`
event also neutralises the questionnaire answer. Conversely, clearing the original
answer in the review editor does **not** restore inference when a later timeline
`yes`/`maybe`/`no` exists — the timeline answer still wins. Getting back to
inference after stating timeline intent requires an `auto` event; that is the only
mechanism, deliberately.

Timeline form presentation:

```text
Would you still recommend it?

Currently: Yes — from your last timeline update
[ Yes ]  [ Maybe ]  [ No ]

Leave unanswered to keep your current recommendation.   [ Use rating automatically ]
```

When the state is inferred: `Currently: Recommending — inferred from your 4.5 rating`.

Submission semantics:

- untouched → field omitted; intent and source unchanged
- `Yes`/`Maybe`/`No` → append that explicit intent
- "Use rating automatically" → append `auto`
- re-tap the selected value → back to untouched/omitted, **not** `auto`

Current state is always displayed, never preselected, so "current state", "new
statement", "no statement" and "deliberate return to inference" stay four distinct
things.

Divergence nudge only, never inference: when an update drops the effective rating
below 4 while an explicit `yes` stands, show
`Your rating is now 2.5, but your latest answer is still Yes. Update it?` and leave
the control unselected. Someone can still recommend something they enjoyed less.

## Envelope validation (strict)

The questionnaire answer overrides the fallback **only** when all hold:
`metadata.questionnaire` is a JSON object; `version` is in the supported set (v1:
exactly `1`); `type` strictly equals the review's canonical `category`; `answers`
is a JSON object; `would_recommend` is exactly `yes`, `maybe` or `no`. Absent,
malformed, unsupported-version or type-mismatched envelopes fall back to the rating
rule. An arbitrary string is **never** read as `false`.

## Timeline intent is a security-sensitive write (verified gap)

Inserting a `review_updates` row will now change another table's
`reviews.is_recommended`, so authorization matters at the **database** boundary, not
in the form.

Verified today: the INSERT policy on `review_updates` is
`WITH CHECK (auth.uid() = user_id)` **only** — it never checks that the user owns
the referenced review. And `update_review_timeline_stats_enhanced` takes the latest
rating from any row with that `review_id` regardless of author. So a signed-in user
can already append an update to a stranger's review and move its `latest_rating`,
`timeline_count`, `trust_score` and therefore `is_recommended`. Adding intent to
that column turns an existing hole into a direct recommendation-forgery path.

3C must therefore, in the same migration: require `review_id` to belong to a review
owned by `auth.uid()` in the INSERT policy; restrict UPDATE so `created_at`,
`review_id`, `user_id` and `would_recommend` cannot be rewritten (intent events
immutable); and cover both with tests that attempt the forgery and expect a denial.
This is a pre-existing bug being fixed alongside, not scope creep — the feature is
unsafe to ship without it.

## One resolver, two implementations, one executable fixture

Precedence will exist in SQL (trigger) and TypeScript (form copy, and later
analytics). Postgres can't read a repo file, so parity is enforced by a harness,
not by hoping two suites agree:

```text
shared fixture (TS/JSON, canonical truth table)
        |-- Vitest       -> TypeScript resolver
        |-- Deno harness -> calls the SQL resolver per case against the database
```

Fixture cases are **ordered event objects** with explicit ids and timestamps, so
"auto then no" is encoded rather than described in prose. Frozen cases:


| timeline | original | effective rating | intent | isRecommended | source |
|---|---|---|---|---|---|
| `no` | `yes` | 5 | no | false | timeline_explicit |
| — | `yes` | 2 | yes | true | review_explicit |
| — | `maybe` | 5 | maybe | false | review_explicit |
| — | — | 5 | null | true | rating_inferred |
| — | — | 3 | null | false | rating_inferred |
| `auto` | `yes` | 5 | null | true | rating_inferred |
| `auto` | `yes` | 2 | null | false | rating_inferred |
| `auto` then `no` | `yes` | 5 | no | false | timeline_explicit |
| `no` then `auto` | `yes` | 5 | null | true | rating_inferred |
| — | malformed envelope (`yes`) | 5 | null | true | rating_inferred |
| — | wrong `type` (`yes`) | 3 | null | false | rating_inferred |
| — | `version: 999` (`yes`) | 5 | null | true | rating_inferred |

## Trigger consolidation (narrow, behaviour-preserving)

Architecture for 3C:

```text
pure SQL resolver(metadata, latest timeline intent, effective rating)
        -> intent, source, is_recommended
review trigger        : applies resolver output only
timeline stats trigger: latest_rating + counts, then one review recomputation
trust scoring         : preserved as-is, tested separately
```

- Both existing recommendation triggers on `reviews` are dropped in the same
  migration, so execution order stops mattering, and the resolver must not depend
  on trigger names or ordering.
- Keep `update_review_timeline_stats_enhanced`, drop the older
  `update_review_timeline_stats`; the enhanced one's second no-op UPDATE becomes
  unnecessary once the consolidated trigger reads intent directly.
- Trust scoring is **not** redesigned. Copying `calculate_trust_score(NEW.id)` into
  a BEFORE INSERT context is not automatically behaviour-preserving — the row does
  not exist yet — so 3C proves preservation two ways:
  1. **Whole-dataset comparison, not a sample.** With 77 reviews there is no reason
     to sample: snapshot `trust_score`, `latest_rating`, `timeline_count` and
     `is_recommended` for **every** review before the migration and assert each is
     byte-identical after, since no review currently has explicit intent.
  2. **Controlled trigger fixtures** covering initial insert, unrelated review edit,
     rating edit, timeline insertion, and a recommendation-only metadata edit —
     asserting the resulting values, not the number of redundant recalculations.
- Recommendation counts, `latest_rating` behaviour and timeline counts are
  regression-tested, not just eyeballed.

## Field IDs and stored values (frozen)

| Field id | Stored values | Labels |
|---|---|---|
| `would_recommend` | `yes` / `maybe` / `no` | Yes / Maybe / No |
| `repeat_intent` | `yes` / `maybe` / `no` | per-type: Order again? / Go back? / Buy again? / Rewatch? / Keep using? / Attend again? … |
| `value` | `poor` / `fair` / `good` / `excellent` | Not worth it / Okay / Worth it / Great value |
| `worth_time` | `yes` / `mostly` / `no` | Yes / Mostly / No |
| `trust` | `low` / `medium` / `high` | Low / Medium / High |
| `solves_problem` | `yes` / `partly` / `no` | Yes / Partly / No |
| `portion` | `small` / `just_right` / `large` | Small / Just right / Large |
| `stood_out`, `best_for` | snake_case tag ids | curated labels |

Unanswered fields are omitted from `answers` — never `""`, `null`, `[]`. Nothing is
preselected; re-tapping the selected option clears it.

## Tags

`CuratedTagSelector` is the shared primitive; `FoodTagSelector` becomes a thin
wrapper preserving its 13 tags, emojis, custom input, Plus button, Enter key,
styling and `metadata.food_tags` byte-identically, exempt from the new cap.

Sentiment is registry metadata, never stored —
`{ value: 'slow_pacing', label: 'Slow pacing', emoji: '🐢', sentiment: 'negative' }`
with `positive | neutral | negative`; `neutral` matters for preference-dependent
tags (crowded, challenging, fast-paced).

```json
{
  "questionnaire": {
    "version": 1,
    "type": "movie",
    "answers": {
      "would_recommend": "yes",
      "repeat_intent": "maybe",
      "stood_out": { "selected": ["story", "cinematography"], "custom": ["Great practical effects"] }
    }
  }
}
```

Limits: 5 combined selected + custom, max 3 custom, 40 chars each, NFC-normalized
and trimmed before case-insensitive dedupe while preserving the user's casing,
never blank.

## Final v1 matrix

Every type gets `would_recommend` + `stood_out`, plus:

| Type | Repeat intent | Extra |
|---|---|---|
| food | Order again? | `portion` (no `value` — Food Tags already carry "Value for Money") |
| place | Go back? | `best_for` (family/couples/solo removed from `stood_out`) |
| product | Buy again? | `value` (value tags removed from `stood_out`) |
| brand | Buy from them again? | `trust` |
| movie | Rewatch? | — |
| tv_show | Watch more? | `worth_time` |
| book | Read again? | `worth_time` |
| game | Play again? | `worth_time` |
| app | Keep using? | `solves_problem` |
| course | — | `worth_time` + `best_for` |
| service | Use again? | `value` |
| professional | Work with them again? | `trust` |
| event | Attend again? | `worth_time` |
| experience | Do again? | `worth_time` |
| others | Choose again? | — |

`legacy_unlinked` gets none of this. Vocabularies stay balanced with a few
high-signal negatives; `professional` uses behaviour-only negatives (Slow to
respond, Unclear communication, Missed deadlines) — never character or misconduct
labels.

## Also noted for 3D cleanup

`reviews.is_converted` becomes vestigial once Convert is retired — it gates only
that menu item and is never written. 3D decides between dropping the column and
documenting it as legacy; 3C just stops reading it.

## What closes 3B

The verbatim **tag id + label + emoji + sentiment table for the 14 non-food
vocabularies**, delivered as the final 3B artefact once you approve the contracts
above. Then 3C ships UI + persistence + the trigger/column migration together,
verified across all 15 types and every fixture row.

## Out of scope

Any UI code, registry edit or migration in 3B; the legacy `recommendations` table;
redesigning trust scoring; persisting intent/source columns; conditional questions;
making anything required; step/layout restructuring; Phase 2.5B.
