# Phase 0 — Canonical Types + Provider/Offering Contract

## You're right, and I was wrong

Deleting all 72 reviews was bad advice. Your counter-argument is correct: by that logic every dummy entity and user goes too, and you'd lose the fixtures you actively test against. "Dummy" is not the same as "worthless" — these rows exercise review cards, profile filters, entity-page sections, rating aggregates, media, visibility, edit flows, and the null-entity path. Phase 0 is now **non-destructive**: no deletes, no rewrites.

I also accept the two corrections both reviews made:

- **Provider/offering are roles, not entity types.** They describe how an entity is being used in a relationship. They do not go into the Supabase `entity_type` enum, which stays at 15.
- **`parent_id` does not mean "provider."** It's a generic parent/child edge. Provider→offering is one *semantic use* of it. Keeping that distinction is what leaves room for other relationship kinds later.

And the 17 mismatched rows stay put. They're the best fixtures you have for the exact ambiguity the new architecture has to resolve — deleting them removes your regression coverage for legacy rendering.

## What I verified about the graph (this is the important part)

Neither review could confirm whether `place → food` actually works. I checked:

- **`parent_id` has no type constraint.** The only check is `chk_entities_no_self_reference`. `place → food` is already permitted at the database level — nothing to migrate.
- **The FK is `ON DELETE SET NULL`.** Deleting a restaurant does not delete its dishes; it orphans them. That is safer than a cascade but means an orphan-offering cleanup path is needed eventually.
- **`slug` is globally `UNIQUE`.** Two restaurants both offering a "Classic Burger" would collide — except `setEntityParent` already generates `parentSlug-childSlug` (`entityHierarchyService.ts:211`), which resolves it. **But that only runs in the reparenting path.** Whatever new dish-creation flow gets built must use the same hierarchical slug rule or it will hit a unique violation. This is the single most likely thing to break.
- **The rendering layer is already generic.** `EntityV4` passes `childEntities` / `parentEntity`, `use-related-entities` and `use-entity-siblings` are type-agnostic, hierarchical URLs `/:parentSlug/:childSlug` exist, and `get_child_entities_with_ratings` returns ratings for any child type.
- **But the copy is hardcoded.** `FeaturedProductsSection.tsx` renders "Featured Products" and "View All N Products". A restaurant's dishes would appear under the heading "Featured Products". Mechanism generic, vocabulary not.
- **No `parent.type === 'brand'` branching exists** in the hierarchy logic. The two `'brand'` checks found are cosmetic image-fit rules in `EntityHeader.tsx`.

So: the graph is genuinely generic, one slug rule must be reused, one FK behaviour noted, and the labels need to become relationship-derived.

## Scalability — the part you asked for, and neither review answered

Both reviews said "keep it general" but neither said *how*. Hardcoding `PROVIDER_TYPES = ['brand', 'place']` is the trap. The answer is a **relationship registry**: one declarative table of allowed provider→offering pairs, with the vocabulary attached.

```text
{ provider: 'brand',        offering: 'product', offeringPlural: 'Products',   verb: 'by'   }
{ provider: 'place',        offering: 'food',    offeringPlural: 'Dishes',     verb: 'at'   }
{ provider: 'place',        offering: 'service', offeringPlural: 'Services',   verb: 'at'   }  // later
{ provider: 'professional', offering: 'service', offeringPlural: 'Services',   verb: 'from' }  // later
{ provider: 'brand',        offering: 'app',     offeringPlural: 'Apps',       verb: 'by'   }  // later
```

Everything derives from this one table:

- **Can X be a provider?** → is it the `provider` of any row.
- **What can I add under this entity?** → the `offering` types of its rows. Drives the "Add a dish / Add a product" affordance without a single `if (type === 'place')`.
- **What do we call the child section?** → `offeringPlural`. "Featured Products" becomes "Dishes" under a restaurant, purely from data.
- **How do we render an offering's context line?** → `Classic Burger` + `at` + `Truffles`; `Pegasus 43` + `by` + `Nike`. The verb is registry data, not a conditional.
- **Adding a sixth relationship** = one row plus its questionnaire entry. No component edits. That is the scalability test, and it's the reason to build the registry in Phase 0 even though only two rows are active.

Two design rules that keep it scalable:

1. **Many-to-many, not one provider type per offering type.** `service` will have several provider types. Don't model it as `offering → its one provider type`.
2. **Validate at the application boundary, not with a DB check constraint.** A check constraint on `(parent.type, child.type)` would need a migration for every new relationship. Application-level validation plus the registry keeps the graph open for non-provider parent/child uses (variants, editions, chain→location).

## Phase 0 scope

Code, documentation, audit and tests. **No data changes. No review-form changes. No visible UX change.**

**0.1 Reproducible baseline**
- Save the audit queries *and* their SQL, timestamped — not prose numbers. (The taxonomy count moved 145 → 155 between audits; that drift is exactly why.)
- Baseline: entities by type; parent/child pairs by type; deprecated-type counts; reviews by category; reviews with null `entity_id`; review-category vs entity-type; recommendations by category; total counts.
- Record the IDs of the 17 mismatched and 27 entity-less reviews as **named compatibility fixtures**, so future work knows they are deliberate.

**0.2 One canonical type module**
- The 15 canonical types, `CanonicalEntityType`, `isCanonicalEntityType`, `parseEntityType(): CanonicalEntityType | null`.
- **Plain TypeScript, zero React imports** (Codex's point is right) — services and edge-shared code must be able to import it. Icons, labels and fallback images live in a separate UI config keyed exhaustively by `CanonicalEntityType`.
- No `'unsupported'` pseudo-value: `null` means invalid, so nobody can persist a 16th type.

**0.3 Kill silent fallbacks**
- Remove every `unknown → product` and `unknown → place`. Each caller gets an intentional path: reject the payload, render generically without mutating the stored type, or log and render safely. Do not swap `return 'product'` for `return null` and leave a null dereference behind.
- The distinction to hold: `entity.type = service` with a *generic questionnaire* is fine; `entity.type = service` producing `category = 'product'` is not.

**0.4 Deprecated types, audited then removed**
- Classify every reference to `TV`, `Activity`, `Music`, `Art`, `Drink`, `Travel` as dead code (delete), internal logic (replace), or external boundary (normalize on the way in only).
- Safe: zero rows. The Supabase enum already holds only the 15 — no migration.

**0.5 Consumer inventory, no semantic changes**
- Inventory every reader/writer of `entities.type`, `reviews.category`, `recommendations.category`, `parent_id` — components, services, hooks, search, edge functions, SQL functions, filters, analytics, AI summaries, admin tools.
- **`recommendations` is audit-only.** Recommendations are your next project; Phase 0 must not start that refactor. This is the scope-creep boundary.
- `reviews.category` keeps its current write behaviour. Record the future invariant (`reviews.category === subject.type`) as a target, don't enforce it yet.

**0.6 Relationship registry + provider/offering doc**
- Build the registry above with the two live rows (`brand → product`, `place → food`) and wire the child-section label and offering context line to read from it. This replaces the hardcoded "Featured Products" copy — the one behaviour change in Phase 0, and it's a label fix, not a flow change.
- Document: provider and offering are **roles**; a review targets exactly one entity; `parent_id` gives context and never shifts the subject; concepts ("Burger") are a discovery dimension and never the rated subject.
- Note the semantic caveat: `place` is broader than "restaurant", so food-serving is a taxonomy property of the place, not something the type guarantees. Don't enforce it in the database.
- Note that `entities.category_id` is single-valued, so multi-classification of a dish (Burger / American / spicy / main course) is unsolved and deferred.

**0.7 Tests**
- All 15 canonical values parse and round-trip; unknown returns null and never becomes `product` or `place`; legacy aliases work only at the approved boundary and are never written; `service`/`professional` never map to `product`.
- Registry: `place → food` allowed, `brand → product` allowed, an unregistered pair rejected, adding a row needs no component change.
- Compatibility: existing reads tolerate null entity, food-on-place, product-on-brand.
- Slug: a hierarchical child slug is generated for a `place → food` child, and two same-named dishes under different places don't collide.

## Explicitly out of scope

Deleting or rewriting any review. Creating dish or product entities. Review-wizard changes. Removing the category step. Questionnaires. Recommendation signals or `recommendation_category`. Dish search or concept aggregation. Menu ingestion. Category inheritance. `entity_id NOT NULL`. A separate provider/offering table.

## Main risk

Removing the fallbacks will expose code paths that quietly depended on invalid values. That's the point — but every exposed caller needs a deliberate failure or display path, which is why 0.5's inventory comes before 0.3's deletions land.

## After Phase 0

Phase 1 merges the wizard refactor with the subject-model change (a category-first wizard nobody sees isn't worth shipping alone): subject-first search returning both providers and offerings, the category step gone, and a lightweight "add a dish at this restaurant" path — provider, name, optional concept, create, continue — not the full admin entity dialog. That flow must reuse the hierarchical slug rule.
