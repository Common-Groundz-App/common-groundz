# Provider / Offering Contract

## Roles, not types

**Provider** and **offering** are *roles* — they describe how an entity is being used in a
relationship. They are not entity types and are never added to the Supabase `entity_type` enum,
which stays at exactly 15 canonical values (see `src/services/entityType.ts`).

- A restaurant (`place`) acts as a **provider** for its dishes (`food`).
- A brand (`brand`) acts as a **provider** for its products (`product`).
- The same `place` row is an ordinary subject when someone reviews the restaurant itself.

## `parent_id` is a generic edge

`entities.parent_id` is a generic parent/child edge. Provider → offering is one *semantic use* of
it. Other future uses (variants, editions, chain → location, series → book) must remain legal.

Consequences:

- The registry (`src/services/entityRelationshipRegistry.ts`) answers "is this an offering pair?".
- `assertValidOfferingPair()` is called from **offering-creation paths only** — never as a blanket
  guard on every reparent.
- An unregistered pair means "not an offering relationship", **not** "invalid data".
- Validation lives at the application boundary, not in a DB check constraint, so adding a
  relationship never needs a migration.

## Registry is the single source of vocabulary

One declarative table drives everything: can X be a provider, what may be added under it, what the
child section is called (`offeringPlural`), and the connector for a context line (`verb`):

```text
Classic Burger  at  Truffles      // place -> food
Pegasus 43      by  Nike          // brand -> product
```

Adding a sixth relationship is one row plus its questionnaire entry — no component edits. Modelled
many-to-many on purpose: `service` will eventually have several provider types.

## Subject invariants

- **A review targets exactly one entity.** `parent_id` supplies context and never shifts the
  subject. A dish review targets the `food` entity that has the restaurant as its parent.
- **Concepts ("Burger", "hydrating serum") are a discovery dimension**, never the rated subject.
- Target future invariant: `reviews.category === subject.type`. **Not enforced yet** — Phase 0 left
  `reviews.category` write behaviour unchanged.

## Type parsing rules

- `parseEntityType()` — strict. Returns `null` for anything that is not one of the 15. Use this on
  every persistence path. There is no silent fallback to `product` or `place`.
- `parseEntityTypeAtBoundary()` — accepts legacy aliases (`tv`, `activity`, `music`, `art`,
  `drink`, `travel`, `people`) on the way **in** only. It never emits a legacy value.
- `getCanonicalType()` in `entityTypeHelpers.ts` is **display-only**: it degrades unknown values to
  `others` so rendering stays safe. Its result must never be written to the database.
- The deprecated TypeScript enum members (`TV`, `Activity`, `Music`, `Art`, `Drink`, `Travel`) have
  been removed. Zero rows used them, so no migration was required.

## Slug rule (the most likely thing to break)

`entities.slug` is globally `UNIQUE`. Two restaurants both offering a "Classic Burger" would
collide. The hierarchical rule `parentSlug-childSlug` resolves it and now lives in
`src/services/entitySlug.ts` (`buildHierarchicalSlug`, `slugifyEntityName`), used by
`setEntityParent`. **Any new offering-creation flow must use these helpers.**

## Known gaps for Phase 1

- `FeaturedProductsSection.tsx` hardcodes "Featured Products" / "View All N Products" — must be
  wired to `getOfferingSectionLabel()`.
- `entities.parent_id` FK is `ON DELETE SET NULL`: deleting a provider orphans its offerings, so an
  orphan-cleanup path is eventually needed.
- `entities.category_id` is single-valued, so multi-classifying a dish (Burger / American / spicy /
  main course) is unsolved.
- `place` is broader than "restaurant". Food-serving is a taxonomy property, not a type guarantee,
  and must not be enforced in the database.
