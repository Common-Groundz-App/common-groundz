# Phase 1 — Relationship-aware labels on the V4 entity page (V4 only)

Phase 0 is verified complete. Phase 1 makes the **V4 entity page** stop assuming every child is a "Product". Verified facts:

- `/entity/:slug` renders V4 for everyone. V2 (`EntityDetailV2`) is reachable only by internal users via `?v=2` — **no V2 changes in this phase**.
- The V4 child-entity surfaces are exactly four: overview preview card, child tab, child-tab list, and the sidebar card. Plus one child-page context line and the sibling carousel.
- `EntityProductsCard.tsx` is V2-only → untouched. The "Coming Soon: Product management interface" block lives in V4's empty Products tab → in scope.

## Core rule

Registry vocabulary ("Dishes", "Products", "at", "by") is used **only** when `(parent.type, child.type)` is a registered offering pair (`brand→product`, `place→food`). Anything else renders as generic "Related" — never hidden, never mislabeled. Registry stays at those two pairs (no `place→product` yet), so a single provider has at most one offering type today.

## Single source of truth (new requirement)

One pure helper — `getChildPresentation(parentType, children)` added to `src/services/entityRelationshipRegistry.ts` — is the **only** place that decides child presentation. All four V4 surfaces (overview preview, child tab, child-tab list, sidebar card) call it; **no component computes its own label or grouping**. It returns:

```text
{
  mode: 'none' | 'single' | 'mixed',
  label: 'Products' | 'Dishes' | 'Offerings' | 'Related' | null,  // null when mode='none'
  groups: [{ type | null, label, children }]   // stable order; empty when mode='none'
}
```

Grouping rules (group-preserving — an odd child never collapses valid groups):
- Children are split into groups by type. Each registered `(parent, childType)` pair forms a group with its registry label ("Dishes", "Products"). All unregistered/generic children form one trailing group labelled **"Related"**.
- Zero children → `mode: 'none'`, `label: null` (tab and section hidden).
- Exactly one group → `mode: 'single'`, label = that group's label ("Products" / "Dishes" / "Related").
- More than one group → `mode: 'mixed'`, aggregate `label: 'Offerings'`. Example: a place with 8 dishes + 1 generic child yields groups `Dishes (8)` + `Related (1)` — it does **not** collapse to "Related 9".

Rendering rules for components:
- `single` → one section/tab using `label`.
- `mixed` → aggregate label "Offerings" for the tab; inside, render each group under its own heading ("Dishes 8", "Related 1") in stable order. Unlike children are never combined under one heading.
- Mixed rendering stays **minimal**: headings + the existing list/grid, nothing else. No filtering, grouping menus, or other UX in this phase.

## The six visible changes (in plain words)

### 1. Overview tab → "Featured Products" card
File: `FeaturedProductsSection.tsx` → **renamed `RelatedEntitiesSection.tsx`** (call site: `EntityTabsContent.tsx`).
- Single group: Cosmix still says **Featured Products** (identical to today); a restaurant says **Featured Dishes**; unregistered children: **Related**.
- Mixed groups (future): separate minimal sections — "Featured Dishes" and "Featured Products" — never one combined "Featured Offerings" list mixing unlike children.
- The hidden "View All N Products" button (only appears at 5+ children) becomes "View all N {group label}", matching the section's group.

### 2. The child tab (currently "Products 4")
File: `EntityTabsContent.tsx`.
- Labels come only from the helper: single group → **Products 4** (Cosmix, unchanged) / **Dishes 8**; mixed → **Offerings N** with per-group headings inside; zero children → **tab hidden entirely**.
- "Showing 4 products" footer → "Showing 4 dishes" etc. Empty-state copy generalized; the "Coming Soon: Product management interface" block is removed.

### 3. "View All" actually works on V4
File: `EntityV4.tsx`.
- `handleViewAllProducts` currently shows a toast. It becomes a real switch to the child tab (V2 already does this via `setActiveTab`). The full tab gets no redundant "View all".

### 4. Right sidebar → "Related Products (4)" card
Files: `EntitySidebar.tsx` (passes parent type down) + `EntityChildrenCard.tsx` (renders).
- Labels from the helper: Cosmix: **Products (4)**. Restaurant: **Dishes (8)**. Mixed: **Offerings (N)** with per-group headings; generic-only: **Related (N)**.
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
- **Internal identifier renames** (so correct labels don't sit on product-specific internals): tab key `products` → `children`, `handleViewAllProducts` → `handleViewAllChildren`, `onViewAllProducts` prop → `onViewAll`, product-specific locals → child/offering names. **Caveat:** if the tab key is synced to the URL (`?tab=products`), keep the old value working by mapping `products` → `children` on read; write only the new key.
- **Loading/hero fallback image (conditional, display-only):** `EntityV4.tsx` ~467 and `EntityV4LoadingWrapper` hardcode `EntityType.Product` / `'product'`, which only picks the stock image shown while data loads. Change it **only if** verified that a product-themed image visibly flashes on non-product pages; if fixed, use the neutral `Others` display image. This is a display preference, not semantic type logic — Phase 0's ban on semantic fallbacks does not apply to a loading image.

## Explicitly out of scope

- No V2 (`EntityDetailV2.tsx`) changes. No `ReviewForm` / category-step changes. No dish/product creation UX. No database or data changes. No `place→product` registry entry.

## Tests

- `getChildPresentation` unit tests for all four shapes: zero children → none; single registered pair → Products/Dishes; multiple registered types → Offerings; unregistered/generic children → Related.
- brand→product renders identical labels to today (Cosmix regression).
- place→food renders "Dishes" in overview, tab, sidebar; context line "Dish at {Place}" links to parent slug.
- Zero children → tab hidden; "View All" switches tabs (no toast).
- `bunx vitest run` green + typecheck.

## After Phase 1

Report exact components changed, before/after labels for Cosmix and a place→food example, tests added — then stop before Phase 2 (entity-first review subject).

## Later phases (unchanged outline)

- **Phase 2** — Entity-first review subject: delete the category step, derive `reviews.category = subject.type`, dish creation under a place via `assertValidOfferingPair()` + hierarchical slug.
- **Phase 3** — Config-driven per-type questionnaires in JSONB.
- **Phase 4** — Retire `RecommendationCategory` legacy enum, migrate its 9 rows, align recommendation routes/badges to canonical types.
