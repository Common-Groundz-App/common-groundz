# Search Page: "Already on Groundz" Redesign + Aggregated Ratings

## Goal
Transform search into a clean routing surface. Hide noisy raw review/recommendation rows, show entities with aggregated rating signals (ConnectedRings + count), and unify visual design with the "All Items" section. All changes scoped tightly to the Search page — no cross-surface side effects.

## Pre-flight (read-only checks before any edits)
1. Confirm `entity_stats_view` exposes `entity_id`, `average_rating`, `review_count` columns and is queryable from the edge function context.
2. Read all tab filter logic in `src/pages/Search.tsx` to confirm every tab (Movies, Books, Places, Products, Food, etc.) filters on `entity.type` — not on review/recommendation fields. If any tab depends on review/recommendation rows, surface that before proceeding.

## File 1 — `supabase/functions/unified-search-v2/index.ts`
- After fetching/hydrating entities, if `entities.length > 0`:
  - Fire a separate parallel query to `entity_stats_view` for those entity IDs (NOT a SQL JOIN).
  - Wrap in try/catch — on failure, log a warning and return entities without rating fields.
  - Merge `average_rating` and `review_count` onto each entity in JS.
- If `entities.length === 0`, skip the stats query entirely.
- **No ranking changes here.** Backend stays neutral; existing consumers (Explore, dropdowns, autocomplete) are unaffected.
- Response shape: same as today plus two new optional fields per entity.

## File 2 — `src/hooks/use-unified-search.ts`
- Add to `EntitySearchResult` interface:
  - `average_rating?: number | null`
  - `review_count?: number`
- Both optional → backward compatible with all existing consumers and any cached payloads.

## File 3 — `src/components/search/EntityResultItem.tsx` (visual redesign)
Rebuild to mirror the "All Items" row visual language:
- Replace circular `Avatar` with square thumbnail (`rounded-md`) using `ImageWithFallback` or equivalent.
- Replace outline gray badge with orange filled badge (`bg-primary/10 text-primary`).
- Layout: title-first, description below, badge + rating row at bottom-left.
- Render `ConnectedRingsRating` + `{Number(entity.average_rating ?? 0).toFixed(1)} · {entity.review_count} review(s)` **only when** `entity.review_count > 0 && entity.average_rating != null`. Pluralize correctly (1 review / N reviews).
- Match typography, spacing, hover state, and padding to "All Items" rows.
- Keep existing `Link` wrapper, hover behavior, and `getEntityUrlWithParent` routing — only presentation changes.

## File 4 — `src/pages/Search.tsx`
**Data narrowing**
- Narrow `allLocalResults` to entities only (`__cg_kind: 'entity'`).
- Update `TaggedLocalResult` type and `renderLocalResultItem` to handle the entity-only case (keep an exhaustiveness check for future expansion).

**Visual cleanup**
- Remove the outer bordered container wrapping the "Already on Groundz" list so it sits flat like "All Items".
- Add `last:border-b-0` to row separators.

**Client-side ranking (scoped to this page only)**
When `query.trim().length >= 2`, sort entities just before render:
1. Exact name match (case-insensitive) first
2. Prefix name match (case-insensitive) next
3. `review_count` DESC (treat `undefined` as 0)
4. `name.localeCompare` ASC (deterministic tiebreaker — prevents reload-order drift)

When `query.trim().length < 2`, do not sort — render in backend order.

**Apply consistently across ALL tab variants** (Movies, Books, Places, Products, Food, etc.) so the visual treatment is uniform throughout the search page.

## Acceptance criteria
1. "Already on Groundz" and "All Items" are visually indistinguishable in styling — same thumbnails, badges, typography, no outer container difference.
2. Rating row appears only when the entity has real review data (no "0.0" anywhere, no empty rating row).
3. Searching "isha" returns 3 entity rows with no repeating Foundation review/recommendation rows.
4. All tab variants (Movies/Books/Places/Products/Food) still filter and display correctly.
5. If `entity_stats_view` query fails in the edge function, entities still render (rating row hidden).
6. Stats query is skipped when no entities are returned.
7. Ranking applied only for queries ≥ 2 chars; identical entities keep stable order across reloads.
8. No new console errors introduced; no 400s from misclassified local results.
9. `tsc --noEmit` passes cleanly.
10. Edge function response shape unchanged for all other consumers — only added optional fields.

## Explicitly out of scope
- Explore page (separate future change)
- People / Users section
- Dropdown / `EnhancedSearchInput`
- "All Items" section (it's the design target — do not modify)
- Review snippets / "From the community" UI (Phase 2)
- Section heading copy changes
- "No reviews yet" fallback text
- Backend-side ranking changes (kept client-side intentionally to avoid cross-surface regressions)
- `ReviewResultItem` and `RecommendationResultItem` components — kept in codebase for future use

## Execution order after approval
1. Pre-flight read-only checks (schema + tab filter logic)
2. Edit File 1 (edge function)
3. Edit File 2 (types)
4. Edit File 3 (component)
5. Edit File 4 (page)
6. Run `tsc --noEmit` to verify clean compile
7. Report back with summary of what changed and what to verify in preview
