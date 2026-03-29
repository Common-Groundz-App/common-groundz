

# Refine Post Detail Sidebar — Match Entity V4 Exactly

## Changes — `src/components/content/PostDetailSidebar.tsx` only

### 1. Replace type badge with EntityFollowButton
- Remove the `Place` badge from the header row
- Add `EntityFollowButton` (from `@/components/entity/EntityFollowButton`) right-aligned next to entity name
- Entity name gets `min-w-0 flex-1` + `truncate` to prevent overflow when follow button is present
- Use `size="sm"` on the follow button to fit sidebar width

### 2. Right-align rating numbers (both Overall and Circle)
- Change rating layout from `flex items-center gap-3` to `flex items-center justify-between`
- Rings + labels on left, rating number on right — matching the screenshot of Entity V4

### 3. Add InfoTooltip to Overall Rating and Circle Rating
- Import `InfoTooltip` from `@/components/ui/info-tooltip`
- Add next to "Overall Rating" label: `<InfoTooltip content="Overall Rating is the average review rating from all users who reviewed this item on Common Groundz." />`
- Add next to "Circle Rating" label: `<InfoTooltip content="Circle Rating is the average review rating from people in your Circle (friends or trusted users you follow)." />`
- Same `flex items-center gap-1` pattern as EntityHeader

### 4. Match Recommending row to Entity V4 style
- Change from plain text to Entity V4 pattern: `<span className="text-brand-orange">{count}</span> Recommending`
- Add circle count: `(X from circle)` with `text-brand-orange font-medium` — same markup as EntityHeader lines 529-534
- Add `InfoTooltip` with the same recommendations tooltip content from EntityHeader lines 541-545
- Use `ThumbsUp` icon with `text-brand-orange` tint (already present, just needs text styling fix)

### 5. CTA button styling
- Change "View all experiences" to brand orange: `className="w-full mt-4 text-xs bg-brand-orange hover:bg-brand-orange/90 text-white"`
- Keep wording as "View all experiences" — it accurately describes what clicking does

### 6. Additional refinement
- Add `flex items-center gap-1` wrapper for "Overall Rating" and "Circle Rating" labels (to hold InfoTooltip inline)
- Import: `InfoTooltip` from `@/components/ui/info-tooltip`, `EntityFollowButton` from `@/components/entity/EntityFollowButton`
- Remove: unused `entityTypeLabel` computation

### Files
| File | Change |
|------|--------|
| `src/components/content/PostDetailSidebar.tsx` | All 5 refinements above |

