# Phase 1 — Relationship-aware entity hierarchy UI

Phase 0 is verified complete (15 canonical types, strict parsers, provider/offering registry, hierarchical slugs, 334 tests green). Phase 1 wires the registry into every child-entity surface. No database, review-form, or entity-creation changes.

## Core rule

`parent_id` is a generic edge. Registry vocabulary ("Dishes", "Products", "at", "by") is used **only** when `(parent.type, child.type)` is a registered offering pair. Everything else renders under a generic "Related" label — never hidden, never mislabeled.

## Changes by surface

### 1. `FeaturedProductsSection.tsx` → rename to `RelatedEntitiesSection.tsx`
Used in the V4 overview tab and legacy V2 page.
- Section title: `getOfferingSectionLabel(parent.type, child.type)` → "Dishes" / "Products"; "Related" when unregistered.
- "View All N Products" → `View all N {label}` (lowercase plural from the same registry entry).
- Props renamed: `onViewAllProducts` → `onViewAll`, `featuredProducts` → `featuredChildren`.
- Update both call sites: `EntityTabsContent.tsx` (V4), `EntityDetailV2.tsx` (V2).

### 2. `EntityTabsContent.tsx` (V4 entity page tabs)
- Rename the `products` tab value/label: label comes from the registry for the provider's dominant child group; "Related" fallback. (Tab key stays `products` internally or becomes `children` — one canonical key, applied consistently with V2.)
- Empty state: "No products yet" / "This is a child product of…" → registry-derived or generic copy.
- "Showing N products" footer → "Showing N {label}".
- Remove the "Coming Soon: Product management interface" placeholder block.

### 3. `EntityV4.tsx`
- `handleViewAllProducts` currently fires a toast ("Navigate to products tab"). Replace with a real tab switch (lift tab state or use a ref/callback), mirroring V2's existing `setActiveTab('products')` behavior.
- `EntityType.Product` fallback at line ~467 for the hero image → `EntityType.Others` (product fallback is banned by Phase 0 policy).

### 4. `EntityChildrenCard.tsx` (sidebar children list)
- "Related Products" / "No related products yet" / "Add Product" / "View all N products" → registry labels with "Related" fallback.
- Hide the "Add Product" button (creation UX is Phase 2 scope) — keep the prop, render nothing.

### 5. `EntitySidebar.tsx` (V4)
- The "Related Products - Child Entities" section header becomes registry-driven ("Dishes" / "Products" / "Related").

### 6. `EntityDetailV2.tsx` (legacy V2 page)
- "Products (N)" tab trigger, "No products yet", "child product of", "Add Product", "Showing N products" → same registry treatment.
- `handleViewAllProducts` already switches tabs correctly — keep behavior, rename only.

### 7. `SiblingCarousel.tsx`
- Fallback title "Related Products" → "Related". Keep "More from {parentName}".

### 8. `EntityProductsCard.tsx`
- Audit first: it reads from `entityProductService`, not `parent_id`. If it is not parent/child data, it stays untouched this phase.

### 9. Offering context line on child pages (V4 + V2)
- When viewing an offering (e.g. a dish), render a small subordinate line under the title: `{TypeLabel} {verb} {ParentName}` — "Dish at Truffles" — with the parent name linked to the parent's canonical slug URL.
- Only when a parent exists AND the pair is registered. No invented verbs for unregistered pairs. Never duplicate the entity name in the line.

### 10. Mixed-child grouping
- Group children by child type. Registered groups get registry labels, unregistered groups render under "Related".
- Deterministic order: registry declaration order, then alphabetical by type; groups never reshuffle between renders.
- Each group's "View all" refers to its own group.

### 11. Cleanup
- Delete `src/services/entityTypeMapping.ts` (zero importers).

## Explicitly out of scope

- No `ReviewForm` / `getReviewCategory()` changes (Phase 2).
- No offering-creation UX, no category-step changes, no persistence changes.
- No schema or data migrations.

## Tests

- Registry-driven titles/labels for `brand → product` (regression: existing brand pages render identically) and `place → food`.
- Unregistered pair renders as "Related" and is never dropped.
- Mixed-child grouping order and per-group "View all".
- Context line: shown only for registered pairs, links to parent slug, absent otherwise.
- V4 "View All" switches tabs (no toast).
- `bunx vitest run` green + typecheck.

## After Phase 1

Report exact components changed, brand→product vs place→food rendering evidence, tests added, and any hierarchy assumptions uncovered — then stop before Phase 2 (entity-first review subject).

## Later phases (unchanged outline)

- **Phase 2** — Entity-first review subject: delete the category step, derive `reviews.category = subject.type`, dish creation under a place via `assertValidOfferingPair()` + hierarchical slug.
- **Phase 3** — Config-driven per-type questionnaires in JSONB.
- **Phase 4** — Retire `RecommendationCategory` legacy enum, migrate its 9 rows, align recommendation routes/badges to canonical types.
