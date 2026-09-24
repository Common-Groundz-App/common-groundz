# Group 6E — entity page tab cards (child items)

- `EntityTabsContent.tsx`: the child card picture moved into a new `ChildCardImage`. It trims the link once and uses the trimmed value for both the check and the source. No usable link means no area is drawn. Otherwise it renders `EntityCollectionImage` with `{ id, image_url }` inside the unchanged `w-full h-32 rounded-md overflow-hidden bg-muted mb-3` wrapper. `ImageWithFallback` and `getEntityTypeFallbackImage` are removed from this file.
- Tests: `group6eTabCards.test.tsx`, 10 tests covering null/empty/whitespace, padded link, real, broken, legacy placeholder, legit Unsplash, unknown type, both reset cases, and metadata precedence. Suite 846 passing, tsgo clean. Focused lint shows only the pre-existing issues (no-explicit-any at L220, two exhaustive-deps warnings).
- Intentional no-picture-area exceptions, left unchanged: MyStuffItemCard, EntityProductsCard.
- Authenticated runtime capture is unavailable.
