# Phase 3B — Questionnaire specification (decision 1: recommendation intent)

I agree with Codex's four gates and its simplified matrix. This revision resolves
gate 1 first, as you asked, then folds in gates 2–4. **No UI code ships in 3B.**

## How recommending actually works today (verified)

`reviews.is_recommended` is **not** a user choice. Two triggers on `reviews`, both
`BEFORE INSERT OR UPDATE`, recompute it on every write:

- `trigger_auto_recommend_review` → `auto_recommend_review()` — `rating >= 4`
- `auto_recommend_review_timeline_aware_trigger` → `auto_recommend_review_timeline_aware()`
  — `COALESCE(latest_rating, rating) >= 4`

Both also recompute `trust_score`. The timeline-aware one runs on any update; the
older one on rating updates. So the rule is exactly: **effective rating ≥ 4 ⇒
recommended**, re-evaluated forever, including when a timeline update lowers the
rating.

Consequences found:

- `convertReviewToRecommendation` (duplicated in `services/review/core.ts` and
  `services/reviewService.ts`, exposed via `use-reviews.ts` → `ProfileReviews`
  "Convert" action) writes `is_recommended: true` — and that same UPDATE's trigger
  immediately overwrites it from the rating. On a 3-star review the button shows a
  success toast and changes nothing.
- Live data agrees: 77 reviews, 58 recommended, **0** rows where
  `is_recommended` disagrees with effective rating ≥ 4, in either direction.
- Consumers reading the column: `get_recommendation_count`,
  `get_circle_recommendation_count`, `entityRecommendationService`,
  `review/fetch.ts`, `reviewService.ts`, `enhancedDiscoveryService`,
  `enhancedExploreService`, `entityService`, `smart-assistant`.
- The separate legacy `recommendations` table is unrelated and untouched here;
  `get_network_entity_recommendations` derives its own `rating >= 4` flag from it.

So there is no data conflict to repair — there is a **derived column** and a
**button that lies**.

## Decision: keep the column, change its source of truth, retire the button

`is_recommended` stays as the indexed compatibility signal every feed already
reads. What changes is precedence: the explicit answer wins when the user gave
one; the rating rule remains the fallback so nothing regresses for the other 77
existing reviews and every review made outside the new questionnaire.

| `answers.would_recommend` | `is_recommended` |
|---|---|
| `yes` | `true` |
| `maybe` | `false` |
| `no` | `false` |
| unanswered / no `questionnaire` key | current rule: `COALESCE(latest_rating, rating) >= 4` |

Reasons for this over the alternatives:

- **Not "keep as-is".** Once we ask "Would you recommend it?", a stored `no` on a
  4-star review that feeds show as recommended is a trust bug, and Common Groundz
  is a trust product. Rating and recommending are genuinely different signals.
- **Not "retire the column".** It is read by 6 services, 2 RPCs and an edge
  function, and it is the only fast filter for circle recommendation counts.
  Replacing it with JSONB reads would be a performance and blast-radius disaster
  for zero user-visible gain.
- **Not "derive the column purely from the answer".** Every question is optional,
  so a pure-answer column would silently zero out recommendation counts across the
  whole catalogue the day 3C ships. The fallback prevents that.
- `maybe` maps to `false` deliberately: the boolean means "would actively
  recommend". The `maybe` nuance survives in `answers`, which is where
  aggregation and future "mixed signal" UI should read it.

Timeline behaviour: while `would_recommend` is unanswered, a timeline update that
drops the effective rating below 4 still flips the flag, exactly as today. Once
answered, later rating changes no longer override the stated intent — the user is
asked again in the edit form instead.

**Retire the Convert action** in 3C: delete both `convertReviewToRecommendation`
copies, the `convertToRecommendation` hook member and the `onConvert` prop on
`ReviewCard`/`ProfileReviews`. It cannot work under the triggers, and the
questionnaire answer becomes the honest way to express the same intent.

Implementation shape for 3C (specified here, built there): one migration replaces
the two overlapping triggers with a single `BEFORE INSERT OR UPDATE` function that
reads `NEW.metadata -> 'questionnaire' -> 'answers' ->> 'would_recommend'` and
applies the table above, keeping the `trust_score` recompute. Dropping the
duplicate trigger is part of the fix, not a side quest.

## Gate 2 — stable stored values, never labels (accepted)

Registry options are `{ value, label }`; only `value` is persisted.

| Field id | Stored values | Labels |
|---|---|---|
| `would_recommend` | `yes` / `maybe` / `no` | Yes / Maybe / No |
| `would_again` | `yes` / `maybe` / `no` | Yes / Maybe / No |
| `value` | `poor` / `fair` / `good` / `excellent` | Not worth it / Okay / Worth it / Great value |
| `worth_time` | `yes` / `mostly` / `no` | Yes / Mostly / No |
| `trust` | `low` / `medium` / `high` | Low / Medium / High |
| `solves_problem` | `yes` / `partly` / `no` | Yes / Partly / No |
| `portion` | `small` / `just_right` / `large` | Small / Just right / Large |
| `stood_out` / `best_for` | snake_case tag ids | curated labels (+ emoji, optional) |

Unanswered fields are **omitted** from `answers` — never `""`, `null` or `[]`.
No default is preselected, so unanswered stays distinct from the middle option.
Re-tapping the selected option clears it.

## Gate 3 — reuse the interaction, not the component (accepted)

`CuratedTagSelector` becomes the shared visual primitive; `FoodTagSelector`
becomes a thin wrapper that keeps its 13 tags, emojis, custom input, Plus button,
Enter behaviour, styling and `metadata.food_tags` storage **byte-identically**.
Other types get their own vocabularies through the primitive.

Curated ids and custom text are stored separately so analytics can tell them
apart:

```json
{
  "food_tags": ["Spicy"],
  "questionnaire": {
    "version": 1,
    "type": "movie",
    "answers": {
      "would_recommend": "yes",
      "would_again": "maybe",
      "stood_out": { "selected": ["story", "cinematography"], "custom": ["Great practical effects"] }
    }
  }
}
```

Tag rules: max 5 combined selected + custom, max 3 custom, max 40 chars each,
trimmed, case-insensitively deduplicated, never blank; the cap is shown before it
is hit. Food is exempt — its existing behaviour does not change.

## Gate 4 — final v1 matrix, overlaps removed (accepted)

| Type | Repeat intent | Extra |
|---|---|---|
| food | Order again? | `portion` (no `value` — Food Tags already carry "Value for Money") |
| place | Go back? | `best_for` (family/couples/solo removed from its `stood_out`) |
| product | Buy again? | `value` (value tags removed from `stood_out`) |
| brand | Buy from them again? | `trust` |
| movie | Rewatch? | — |
| tv_show | Watch more? | `worth_time` |
| book | Read again? | `worth_time` |
| game | Play again? | `worth_time` |
| app | Keep using? | `solves_problem` |
| course | — (provider-dependent wording dropped) | `worth_time` + `best_for` |
| service | Use again? | `value` |
| professional | Work with them again? | `trust` |
| event | Attend again? | `worth_time` |
| experience | Do again? | `worth_time` |
| others | Choose again? | — |

Every type also gets `would_recommend` and `stood_out`. `legacy_unlinked` gets
none of this. Vocabularies stay balanced — each set carries a few high-signal
negative tags (Crowded, Buggy, Slow pacing, Too basic…); `professional` uses
behaviour-only negatives (Slow to respond, Unclear communication, Missed
deadlines) and no character or misconduct labels.

## Remaining 3B deliverable

The one thing still open is the **verbatim tag id + label + emoji + sentiment
table for the 14 non-food vocabularies**, reviewed separately as Codex suggests.
I'll bring that as the final 3B artefact once you approve the contracts above.

## Out of scope

Any UI code or registry edit in 3B; the trigger migration (3C); touching the
legacy `recommendations` table; conditional questions; making anything required;
step/layout restructuring; Phase 2.5B.
