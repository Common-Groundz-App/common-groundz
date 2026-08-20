# Phase 0 — Provider / Offering Foundation

## The decision: Model B, and the migration debate is moot

Both reviews spent most of their length arguing about how to preserve the semantic intent of the 17 mismatched reviews. That argument only matters if the data is real. It isn't — it's dummy data, and you've said you're fine deleting it. So the expensive, risky part of both proposals disappears.

What survives from their analysis is the part that actually matters: **Model B is the right destination, and the primitive is provider → offering.** I agree, and there's a stronger reason than either of them gave.

**You already have this primitive, and it already works.** Verified just now:

- 344 entities, 45 with a `parent_id` — and every single one is the same shape: **`brand` → `product`** (45/45).
- There are no other parent/child combinations in use.
- Zero entities use any legacy type (`tv`, `activity`, `music`, `art`, `drink`, `travel`).
- `get_child_entities` and `get_child_entities_with_ratings` already exist as database functions.

So "brand offers products" is a live, working provider/offering relationship. **"Restaurant offers dishes" is the identical shape** — `place` → `food`. You are not inventing an ontology; you are applying the one you already run to a second domain. That is why this is cheap now and why choosing Model A "temporarily" would be a real mistake: it would build a second, contradictory pattern next to a working one.

## Where I part with both reviews

**ChatGPT's `metadata.legacy_review_context` transitional format: skip it.** It's a careful answer to "how do I preserve user intent I can't afford to lose." You can afford to lose it. Adding a transitional schema to preserve dummy rows creates a format that outlives the reason it existed — exactly the trap they both warn about.

**Codex's Phase 0B curated row-by-row conversion: skip it too.** Hand-migrating 17 fake reviews into 17 invented dish entities produces fake dish entities. Worse data, more work.

**Delete the dummy reviews instead.** All 72, or just the 17 mismatched — your call, but I'd argue all 72: 27 have no entity at all, so they exercise a path you're about to forbid, and keeping them means keeping compatibility code for reviews nobody wrote. A clean reviews table lets Phase 1 enforce the invariant from day one instead of coding around history.

**Codex is right that Phase 1 and 2 should merge.** A named-step wizard that deliberately keeps the category step is scaffolding nobody sees. Fold it into the step that removes the category step.

**Codex is also right about JSONB:** `reviews` already has a `metadata` column. No new column in Phase 3 — namespace inside `metadata` and revisit only if querying demands it.

## The three-concept model to write down now

```text
CONCEPT            Burger                    (taxonomy / discovery dimension)
   ^
   | classified as
   |
OFFERING           Truffles Classic Burger   (type: food, parent: Truffles)
   |                                          <- this is what gets reviewed
   | offered by
   v
PROVIDER           Truffles                  (type: place)
                                              <- this is ALSO reviewable
```

Two things this settles:

1. **A review's subject is one entity.** Both a provider and an offering are entities, so "review the restaurant" and "review the dish" are the same mechanism, not two flows. That directly serves your requirement that a user can do either.
2. **The concept layer is not the review subject.** A burger's quality depends on who made it. "Burger" is how search aggregates offerings; it is never what someone rates. This is the one point where naive Model B goes wrong, and both reviews caught it correctly.

Concepts map onto the existing `categories` table (155 rows) rather than becoming entities. Nothing to build in Phase 0 — just don't contradict it later.

## Phase 0 — scope

Code and cleanup only. No UI change, no questionnaire work, no recommendation changes, no form changes.

**0.1 One canonical type module**
- Single source of truth: the 15 canonical types, a type guard, display labels, icons, fallback images.
- Legacy aliases live in a separate boundary-only map — never a valid canonical value.
- `parseEntityType()` returns `CanonicalEntityType | null` (ChatGPT's correction is right — no `'unsupported'` pseudo-type that someone can persist as a 16th value).
- Delete every silent `unknown → product` and `unknown → place` fallback.
- Remove the six deprecated `EntityType` members. Safe: zero rows.
- `entityTypeHelpers.ts`, `entityTypeConfig.ts`, `entityTypeMapping.ts`, the recommendation mapping and the review mapping all read from it.

**0.2 Consumer inventory**
- List every reader/writer of `entities.type`, `reviews.category`, `recommendations.category` — including SQL functions, edge functions, search normalization, admin tools, filters and AI summary paths. TypeScript compiling is not evidence that string-based SQL still works.

**0.3 Document the provider/offering model**
- Write the three-concept model into the repo as the reference for later phases.
- Confirm `place` → `food` uses the same `parent_id` relationship as the existing `brand` → `product`. No schema change expected — this is a verification step, and if it turns out a constraint blocks it, that surfaces here rather than mid-rebuild.

**0.4 Clear the dummy reviews**
- Delete the dummy review rows (recommended: all 72) in a single migration.
- Save the audit queries and their counts as a reproducible before/after record — Codex's point that prose numbers drift is fair (the taxonomy count did move from 145 to 155 between audits).

**0.5 Tests**
- All 15 canonical values round-trip.
- Unsupported input never becomes `product`.
- A `service` entity never produces `reviews.category = 'product'`.
- Legacy aliases normalize only at the boundary and are never written.

## What Phase 0 deliberately does not do

No dish entities. No menu ingestion. No dish deduplication. No category overrides. No dish-level ranking. No search aggregation by concept. No Step 2 removal. No recommendation-signal redesign.

## After Phase 0

Rewrite the later phases with the provider/offering model in hand — the subject step has to search both providers and offerings, which changes what "subject" means in the wizard, so Phases 1 and 2 shouldn't be locked in before that. Then: merged wizard rebuild (subject-first, category step gone), lightweight "add a dish to this place" creation, questionnaires in namespaced `metadata`, and concept aggregation only once real dish reviews exist.

## Open question

Delete all 72 reviews, or only the 17 mismatched ones and keep the other 55? I recommend all 72 — the 27 with no entity exercise a path Phase 1 forbids.
