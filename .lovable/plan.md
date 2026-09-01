# Phase 3B — Question matrix + frozen answer schema (approval only, no UI code)

Phase 3A shipped the registry, the resolver, identity derivation and the safe
metadata merge, but every canonical type still has `sections: []` except food.
3B decides **what to ask** and **how answers are stored**, so 3C can implement
one slice without moving the storage home afterwards.

**No code ships in this phase.** Deliverable = this approved matrix + schema.
Implementation is 3C.

## Rules the matrix obeys

- Rating (Step 1) and subject (Step 2) stay the only required inputs. **Every
  question below is optional in v1.**
- Decision-useful questions only: would you do it again, would you recommend it,
  what stood out, who is it for. No platform/format/metadata trivia.
- Nothing that duplicates an entity fact (director, author, brand, address,
  organizer, price, cuisine) — those live on the entity, not on a review.
- Max 3 type-specific questions per type, one section per type, so Step 4 does
  not become a form wall.
- Shared question ids are reused across types on purpose (`would_again`,
  `would_recommend`, `stood_out`, `best_for`) so answers stay comparable and a
  deliberate subject change keeps meaning where the ids overlap.

## Shared answer vocabularies

- `yesno`: `yes` | `no` | `unsure`
- `stood_out`: short free text (single line, 120 chars)
- `best_for`: short free text (single line, 120 chars)

## The 15-type matrix

| Type | Section title | Q1 | Q2 | Q3 |
|---|---|---|---|---|
| food | What you ate | food tags (existing, unchanged) | `would_again` — "Would you order it again?" | `best_for` — "Best for whom?" |
| place | Your visit | `would_again` — "Would you go back?" | `best_for` — "Who is this place best for?" | `stood_out` — "What stood out?" |
| product | Using it | `would_again` — "Would you buy it again?" | `worth_the_money` — "Worth the money?" | `stood_out` — "What stood out?" |
| brand | Your take | `would_recommend` — "Would you recommend this brand?" | `stood_out` — "What do they get right?" | — |
| movie | Watching it | `would_recommend` — "Would you recommend it?" | `best_for` — "Best for whom?" | `stood_out` — "What stayed with you?" |
| tv_show | Watching it | `would_recommend` — "Would you recommend it?" | `finished_it` — "Did you finish it?" | `best_for` — "Best for whom?" |
| book | Reading it | `would_recommend` — "Would you recommend it?" | `finished_it` — "Did you finish it?" | `best_for` — "Best for whom?" |
| game | Playing it | `would_recommend` — "Would you recommend it?" | `still_playing` — "Still playing it?" | `best_for` — "Best for whom?" |
| app | Using it | `still_using` — "Still using it?" | `worth_the_money` — "Worth paying for?" | `stood_out` — "What does it do well?" |
| course | Was it worth it | `worth_the_time` — "Worth the time?" | `would_recommend` — "Would you recommend it?" | `best_for` — "Best for whom?" |
| service | Your experience | `would_again` — "Would you use them again?" | `worth_the_money` — "Worth the money?" | `stood_out` — "What stood out?" |
| professional | Working with them | `would_again` — "Would you go back to them?" | `would_recommend` — "Would you recommend them?" | `best_for` — "Best for whom?" |
| event | Being there | `would_again` — "Would you attend again?" | `best_for` — "Best for whom?" | `stood_out` — "What stood out?" |
| experience | Doing it | `would_again` — "Would you do it again?" | `best_for` — "Best for whom?" | `stood_out` — "What stood out?" |
| others | Your take | `would_recommend` — "Would you recommend it?" | `stood_out` — "What stood out?" | — |

`legacy_unlinked` keeps **zero** type-specific questions — unchanged from 3A.

Field kinds used: `tags` (food only, existing component), `select` (`yesno`
vocabularies), `text` (`stood_out`, `best_for`). No `multi-select` is needed yet,
so 3C does not build it.

## Frozen answer schema (v1)

Answers live under a single versioned key on `reviews.metadata`. `food_tags` and
provenance keys stay at the root — not migrated just because Phase 3 exists.

```json
{
  "food_tags": ["spicy"],
  "questionnaire": {
    "version": 1,
    "type": "course",
    "answers": { "worth_the_time": "yes", "would_recommend": "yes" }
  }
}
```

Contract rules, frozen here so 3C only implements them:

1. `version` is a monotonically increasing integer. A review without
   `questionnaire.version` opens in legacy compatibility and is never silently
   converted.
2. `type` records the canonical type the answers were given for. If the subject
   is deliberately replaced with a different type, the form switches to the new
   type's questions; unrecognised answer keys are **preserved untouched**, never
   dropped.
3. Unknown / future answer keys are always preserved on save (forward
   compatibility) — writes merge into `answers`, they never replace it.
4. Empty answers are omitted rather than stored as `""` or `null`, so an
   untouched question leaves no trace.
5. Only ids declared in the registry are ever *written*; anything else present is
   read-only ballast that survives.
6. No DB migration, no new column, no backfill — `metadata` JSONB already exists.

## What 3C will then do (for context, not approved here)

Render these fields through the existing `QuestionnaireSections` renderer,
implement `select` + `text` controls, persist via `mergeReviewMetadata` under the
schema above, load answers back on edit, and add per-type tests including the
type-change preservation case.

## Out of scope in 3B

Any UI code, any registry edit, any migration, changing `FoodTagSelector`,
Phase 2.5B remediation, step/layout restructuring (that is the post-Phase-3
refinement step).
