

# Align Post Detail Sidebar with Entity V4 Design System

## Problem
The sidebar uses generic Star/ThumbsUp icons and flat hierarchy that doesn't match the Entity V4 design system used everywhere else in the app.

## Approach
Reuse Entity V4 components directly — treat sidebar as a **compressed but not cramped** version of Entity V4.

## Changes — `src/components/content/PostDetailSidebar.tsx`

### Entity Card restructure

**Imports to add:**
- `ConnectedRingsRating` from `@/components/ui/connected-rings`
- `RatingRingIcon` from `@/components/ui/rating-ring-icon`
- `getSentimentColor`, `getSentimentLabel` from `@/utils/ratingColorUtils`
- `useCircleRating` from `@/hooks/use-circle-rating`
- `CircleContributorsPreview` from `@/components/recommendations/CircleContributorsPreview`

**Remove:** `Star` from lucide imports

**New hierarchy within card (top to bottom):**
1. Hero image (keep as-is)
2. Name + type badge (keep)
3. Venue/location (keep)
4. Description (keep, line-clamp-3)
5. **Overall Rating** (PRIMARY) — `ConnectedRingsRating` (size `"sm"`) + color-coded number via `getSentimentColor()` + `getSentimentLabel()` + `"(X reviews)"` muted text
6. **Circle Rating** (SECONDARY) — `useCircleRating(entity.id)` → `ConnectedRingsRating` for circle rating + `CircleContributorsPreview` avatar stack. `text-brand-orange` label. Only shown when logged in and data exists.
7. **Recommendations count** (TERTIARY) — `ThumbsUp` with count
8. CTA button (keep)

Each section separated by `border-t` dividers with `pt-3 mt-3` spacing.

### Spacing & typography guardrails
- Increase `CardContent` padding from `p-4` to `p-5`
- Match Entity V4 text sizes exactly: rating number `text-lg font-bold`, sentiment label `text-xs`, muted counts `text-xs text-muted-foreground`
- Same font weights, same color tokens, same gaps — no approximations
- Do NOT over-compress: rating and circle sections maintain comfortable line-height and spacing for readability

### Author Card
- Increase padding from `p-4` to `p-5`
- Everything else stays (already has follower count, post count, member since, follow button)

### Loading skeletons
- Update to reflect new section structure (rating block skeleton, circle block skeleton)

## Files
| File | Change |
|------|--------|
| `src/components/content/PostDetailSidebar.tsx` | Replace rating/circle UI with Entity V4 component reuse, fix hierarchy and spacing |

