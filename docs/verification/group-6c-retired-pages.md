# Group 6C — retired unreachable pages and unused components

## Deleted
- src/pages/ProductSearch.tsx (route /product-search/:query)
- src/pages/{Books,Movies,Places,Food,Products}Page.tsx (routes /books /movies /places /food /products)
- src/components/search/ProductResultItem.tsx
- src/components/recommendations/RecommendationForm.tsx

## Proof of non-use (before deletion)
- ProductSearch was reached only from the five category pages; nothing linked to those pages (no nav, footer, notification/share builders, config, no sitemap).
- Live search navigates to /search?q=…&mode=quick.
- ProductResultItem and RecommendationForm had zero importers.

## Decision
No compatibility redirects (user decision). Old paths render the standard NotFound page.

## Kept
EntitySearch (used by AddToMyStuffModal), SearchResultHandler, useUnifiedSearch, ConnectedRingsRating, Search, Explore, My Stuff.

## Verification
- `rg` for the deleted modules and `product-search`: zero references outside tests.
- src/pages/group6cRetiredRoutes.test.tsx (11): six retired paths → NotFound with the URL unchanged; /search, /explore, /my-stuff still resolve.
- Removed the EntityResultThumbnail block from group2aEntityThumbnails.test.tsx.
- Full suite 818/818, tsgo clean.
- Orphans: none new (shared imports of the deleted pages are still used elsewhere).

Historical phase reports left unchanged.
