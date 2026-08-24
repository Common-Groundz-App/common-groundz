# Phase 1 — Relationship-aware labels on the V4 entity page (V4 only)

Phase 0 is verified complete. Phase 1 makes the **V4 entity page** stop assuming every child is a "Product". Verified facts:

- `/entity/:slug` renders V4 for everyone. V2 (`EntityDetailV2`) is reachable only by internal users via `?v=2` — **no V2 changes in this phase**.
- The V4 child-entity surfaces are exactly four: overview preview card, child tab, child-tab list, and the sidebar card. Plus one child-page context line and the sibling carousel.
- `EntityProductsCard.tsx` is V2-only → untouched. The "Coming Soon: Product management interface" block lives in V4's empty Products tab → in scope.

## Core rule

Registry vocabulary ("Dishes", "Products", "at", "by") is used **only** when `(parent.type, child.type)` is a registered offering pair (`brand→product`, `place→food`). Anything else renders as generic "Related" — never hidden, never mislabeled. Registry stays at those two pairs (no `place→product` yet), so a single provider has at most one offering type today.

## Single source of truth (new requirement)

One pure helper — `getChildPresentation(parentType, children)` added to `src/services/entityRelationshipRegistry.ts` — is the **only** place that decides child presentation. All four V4 surfaces (overview preview, child tab, child-tab list, sidebar card) call it; no component computes its own label. It returns:

```text
{
  mode: 'single-offering' | 'mixed' | 'related' | 'none',
  label: 'Products' | 'Dishes' | 'Offerings' | 'Related' | null,
  groups: [{ type, label, children }]   // stable order; empty when mode='none'
}
```

Rules:
- Zero children → `mode: 'none'` (tab and section hidden).
- Exactly one child type with a registered pair → `single-offering` with "Products"/"Dishes".
- Multiple registered offering types → `mixed` with "Offerings" (cannot occur today; rule defined now so a future `place→product` pair needs no component changes).
- Any unregistered/generic children → `related` with "Related".

Mixed-child rendering stays **minimal**: at most one labelled section per group in stable order. No filtering, grouping menus, or other UX is built in this phase.

## The six visible changes (in plain words)

### 1. Overview tab → "Featured Products" card
File: `FeaturedProductsSection.tsx` → **renamed `RelatedEntitiesSection.tsx`** (call site: `EntityTabsContent.tsx`).
- Cosmix (brand→product): still says **Featured Products** — visually identical to today.
- A restaurant (place→food): **Featured Dishes**.
- Unregistered children: **Related**.
- The hidden "View All N Products" button (only appears at 5+ children) becomes "View all N products/dishes", matching the section's group.

### 2. The child tab (currently "Products 4")
File: `EntityTabsContent.tsx`.
- Exactly one child type → registry label: **Products 4** (Cosmix, unchanged) or **Dishes 8** (restaurant).
- More than one child type → **Related N**.
- Zero children → **tab hidden entirely** (no empty tab).
- "Showing 4 products" footer → "Showing 4 dishes" etc. Empty-state copy generalized; the "Coming Soon: Product management interface" block is removed.

### 3. "View All" actually works on V4
File: `EntityV4.tsx`.
- `handleViewAllProducts` currently shows a toast. It becomes a real switch to the child tab (V2 already does this via `setActiveTab`). The full tab gets no redundant "View all".

### 4. Right sidebar → "Related Products (4)" card
Files: `EntitySidebar.tsx` (passes parent type down) + `EntityChildrenCard.tsx` (renders).
- Cosmix: **Products (4)**. Restaurant: **Dishes (8)**. Mixed/unregistered: **Related (N)**.
- ("Related Products" is dropped — they aren't merely *related*, they're Cosmix's products.)
- The "Add Product" button stays hidden — creation UX is Phase 2.
- No new headings added to `EntitySidebar`; only the existing card header changes.

### 5. Child page → parent context line
Files: V4 header area (`EntityV4.tsx` / `EntityHeader`), plus V2 untouched.
- Viewing a dish: a small subordinate line under the title — **"Dish at Truffles"** — with "Truffles" linked to the parent's slug URL.
- Only when a parent exists AND the pair is registered. No invented verbs for unregistered pairs. The entity name never repeats in the line.

### 6. Sibling carousel (child pages)
File: `SiblingCarousel.tsx` (rendered by V4's `ReviewsSection.tsx`).
- Keep **"More from Cosmix"** / **"More from Truffles"** when a parent exists.
- Fallback when no parent name: "Related Products" → **"Related"**.

## Cleanup

- Delete `src/services/entityTypeMapping.ts` (zero importers).
- **Loading/hero fallback image (conditional, display-only):** `EntityV4.tsx` ~467 and `EntityV4LoadingWrapper` hardcode `EntityType.Product` / `'product'`, which only picks the stock image shown while data loads. Change it **only if** verified that a product-themed image visibly flashes on non-product pages; if fixed, use the neutral `Others` display image. This is a display preference, not semantic type logic — Phase 0's ban on semantic fallbacks does not apply to a loading image.

## Explicitly out of scope

- No V2 (`EntityDetailV2.tsx`) changes. No `ReviewForm` / category-step changes. No dish/product creation UX. No database or data changes. No `place→product` registry entry.

## Tests

- brand→product renders identical labels to today (regression).
- place→food renders "Dishes" in overview, tab, sidebar; context line "Dish at {Place}" links to parent slug.
- Unregistered pair → "Related", never dropped; zero children → tab hidden.
- "View All" switches tabs (no toast).
- `bunx vitest run` green + typecheck.

## After Phase 1

Report exact components changed, before/after labels for Cosmix and a place→food example, tests added — then stop before Phase 2 (entity-first review subject).

## Later phases (unchanged outline)

- **Phase 2** — Entity-first review subject: delete the category step, derive `reviews.category = subject.type`, dish creation under a place via `assertValidOfferingPair()` + hierarchical slug.
- **Phase 3** — Config-driven per-type questionnaires in JSONB.
- **Phase 4** — Retire `RecommendationCategory` legacy enum, migrate its 9 rows, align recommendation routes/badges to canonical types.
