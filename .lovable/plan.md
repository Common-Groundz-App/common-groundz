# Phase 3B — Questionnaire specification (v3: recommendation intent + timeline)

I accept all of Codex's additions (envelope validation, explicit timeline policy,
trust-score safety, `repeat_intent` rename, tag sentiment metadata) and ChatGPT's
precedence framing. This revision also makes recommendation intent **evolve with
timeline updates**, as you asked. **No UI code and no migration ship in 3B.**

## Verified current behaviour

`reviews.is_recommended` is fully derived. Two `BEFORE INSERT OR UPDATE` triggers
on `reviews` recompute it on every write:

- `trigger_auto_recommend_review` → `rating >= 4`
- `auto_recommend_review_timeline_aware_trigger` → `COALESCE(latest_rating, rating) >= 4`

Both also recompute `trust_score`. Two triggers on `review_updates` overlap as
well: `update_review_timeline_stats` (count + trust) and
`update_review_timeline_stats_enhanced` (count + `latest_rating` + trust, then a
second no-op UPDATE purely to force recommendation re-evaluation).

Data: 77 reviews, 58 recommended, **0** rows disagreeing with effective rating ≥ 4
in either direction. The rule has no exceptions in production.

**The "Convert to Recommendation" action** is the dropdown item in
`ReviewCard.tsx` (lines 320 and 561, upload-cloud icon), inside the "..." menu,
shown only on your own profile's Reviews tab and only while `is_converted` is
false. It writes `is_recommended: true`, which the same UPDATE's trigger reverts
from the rating, and it never sets `is_converted`, so it never hides. It is
retired in 3C: delete both `convertReviewToRecommendation` copies, the
`convertToRecommendation` hook member, the `onConvert` prop and both menu items.

## Recommendation-intent precedence (frozen)

One authoritative chain, evaluated newest-first:

```text
1. latest valid timeline answer   (review_updates.would_recommend)   AUTHORITATIVE
2. original questionnaire answer  (metadata.questionnaire...)        AUTHORITATIVE
3. COALESCE(latest_rating, rating) >= 4                              INFERRED FALLBACK
```

Answer → flag: `yes` → `true`; `maybe` → `false`; `no` → `false`. `maybe` keeps
its nuance in the stored answer; the boolean means "would actively recommend".

Rationale: rating answers "how good was it", recommending answers "should someone
else choose it" — 3 stars/"yes, great for beginners" and 4 stars/"maybe, far too
expensive" are both real and currently unrepresentable. Keeping the rating rule as
the fallback is what stops recommendation counts collapsing on launch day, since
every question is optional and 77 existing reviews have no answer at all.

`reviews.is_recommended` stays as the indexed compatibility signal for its 6
service consumers, 2 RPCs and the smart-assistant function — nothing starts
reading JSONB in a feed query.

New column `reviews.recommendation_source` (`'explicit' | 'inferred'`, written by
the same trigger) so analytics and future ranking can weight stated intent above
inferred intent instead of treating them as one signal.

## Timeline evolution of intent (your requirement, specified)

`review_updates` gains `would_recommend text` (nullable, constrained to
`yes|maybe|no`) — deliberately a real column, not JSONB, mirroring how
`review_updates.rating` already works.

- The timeline update form gains one optional control: **"Would you still
  recommend it?" — Yes / Maybe / No**, with the current resolved status shown
  beside it ("Currently: recommending" / "not recommending", and whether that came
  from your answer or from your rating).
- Left blank, the update changes nothing about intent: the chain above simply
  falls through to the previous answer, or to the rating if there was never one.
- The resolver picks the **latest non-null** `would_recommend` across
  `review_updates` by `created_at` — the identical pattern
  `update_review_timeline_stats_enhanced` already uses for `latest_rating`.
- A user can revise intent as many times as the journey needs; that is the
  longitudinal-experience moat working as intended.
- Clearing intent: the review editor may set `would_recommend` back to unanswered.
  A cleared original answer plus no timeline answer restores rating-derived
  behaviour immediately. Timeline entries are append-only, so clearing there means
  a new update with an explicit current answer, not editing history.
- Nudge, not inference: when a timeline update drops the effective rating below 4
  while an explicit `yes` stands, the form highlights the still-recommend question
  (unanswered, never preselected). We ask rather than silently overriding.
- Stated intent is never overridden by a later rating change. That is a deliberate
  choice with a test, not a side effect of trigger ordering.

## Envelope validation (accepted, strict)

The explicit answer overrides the fallback **only** when all hold:

- `metadata.questionnaire` is a JSON object
- `version` is an integer in the supported set (v1: exactly `1`)
- `type` strictly equals the review's canonical `category`
- `answers` is a JSON object
- `would_recommend` is exactly `yes`, `maybe` or `no`

Absent, malformed, unsupported-version or type-mismatched envelopes fall back to
the rating rule. An arbitrary string is **never** read as `false`. The same strict
check applies to `review_updates.would_recommend` (a DB check constraint there
makes it cheap).

## Trigger consolidation requirements (accepted)

One `BEFORE INSERT OR UPDATE` trigger on `reviews` replaces both existing
recommendation triggers — the old two are dropped in the same migration so
execution order stops mattering. `trust_score` computation is **carried over
verbatim** (`calculate_trust_score(NEW.id)`); trust scoring is not redesigned
here, and it gets its own regression test. The redundant
`update_review_timeline_stats` / `..._enhanced` pair on `review_updates` is
flagged for the same migration: keep the enhanced one, drop the older one, and its
second no-op UPDATE becomes unnecessary once the consolidated trigger reads intent
directly.

## Field IDs and stored values (frozen)

| Field id | Stored values | Labels |
|---|---|---|
| `would_recommend` | `yes` / `maybe` / `no` | Yes / Maybe / No |
| `repeat_intent` (renamed from `would_again`) | `yes` / `maybe` / `no` | per-type: Order again? / Go back? / Buy again? / Rewatch? / Keep using? / Attend again? … |
| `value` | `poor` / `fair` / `good` / `excellent` | Not worth it / Okay / Worth it / Great value |
| `worth_time` | `yes` / `mostly` / `no` | Yes / Mostly / No |
| `trust` | `low` / `medium` / `high` | Low / Medium / High |
| `solves_problem` | `yes` / `partly` / `no` | Yes / Partly / No |
| `portion` | `small` / `just_right` / `large` | Small / Just right / Large |
| `stood_out`, `best_for` | snake_case tag ids | curated labels |

Unanswered fields are omitted from `answers` — never `""`, `null`, `[]`. Nothing
is preselected, so unanswered stays distinct from the middle option; re-tapping
the selected option clears it.

## Tags (accepted)

`CuratedTagSelector` is the shared primitive; `FoodTagSelector` becomes a thin
wrapper preserving its 13 tags, emojis, custom input, Plus button, Enter key,
styling and `metadata.food_tags` byte-identically, and is exempt from the new cap.

Sentiment is registry metadata, never stored:
`{ value: 'slow_pacing', label: 'Slow pacing', emoji: '🐢', sentiment: 'negative' }`
with `sentiment: 'positive' | 'neutral' | 'negative'` — `neutral` matters for
preference-dependent tags (crowded, challenging, fast-paced).

Curated ids and custom text stored separately:

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

Limits: 5 combined selected + custom, max 3 custom, 40 chars each, Unicode-
normalized (NFC) and trimmed before case-insensitive dedupe while preserving the
user's original casing, never blank.

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

## What closes 3B

The verbatim **tag id + label + emoji + sentiment table for the 14 non-food
vocabularies**, delivered as the final 3B artefact once you approve the contracts
above. Then 3C ships UI + persistence + the trigger/column migration together,
tested across all 15 types and the timeline cases.

## Out of scope

Any UI code, registry edit or migration in 3B; the legacy `recommendations` table;
redesigning trust scoring; conditional questions; making anything required;
step/layout restructuring; Phase 2.5B.
