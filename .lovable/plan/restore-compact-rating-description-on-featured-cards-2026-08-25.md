# Restore compact rating + description on Featured cards

## Goal
The Phase 1 rename of `FeaturedProductsSection` → `RelatedEntitiesSection` accidentally changed card content: the big `ConnectedRingsRating` replaced the old compact sentiment-colored ring + inline number, and the description line was dropped. Keep the new bigger 4-column image cards (user likes them), but restore the old rating style and description text.

## Changes — one file only: `src/components/entity/RelatedEntitiesSection.tsx`

1. **Rating row** — replace the large `ConnectedRingsRating size="xs" showValue` block with the compact pattern used in `EntityChildrenCard` / the old section:
   - `RatingRingIcon rating={childStat.averageRating} size={12}` (single sentiment-colored ring via `getSentimentColor`)
   - Inline rating number next to it (`text-xs font-medium`, e.g. "4.0"), plus review count `(1)` in muted text
   - When no rating: show "No ratings yet" muted text (matches the old card behavior)
2. **Description** — add `child.description` back under the name/rating, `text-xs text-muted-foreground line-clamp-2`, only when present.
3. **Card layout stays** — aspect-square image, 2/4-column grid, hover effects, name `line-clamp-2` all unchanged.
4. Swap the import: remove `ConnectedRingsRating`, add `RatingRingIcon` (already used elsewhere, same color system).

## Resulting card anatomy
```text
┌──────────────┐
│   [image]    │
│ Name (2 ln)  │
│ ◉ 4.0 (1)    │   <- small colored ring + number + count
│ Description… │   <- muted, 2-line clamp
└──────────────┘
```

## Out of scope
- No changes to tab labels, sidebar `EntityChildrenCard` (already uses compact rings), sibling carousel, or any other Phase 1 work.
- No changes to `ConnectedRingsRating` itself — it stays in use elsewhere.

## Verification
- `bunx vitest run` stays green (no logic change).
- Visual check on `/entity/cosmix`: "Featured Products" cards show small colored ring + "4.0 (1)" + description, matching the before.png rating style inside the newer bigger cards.
