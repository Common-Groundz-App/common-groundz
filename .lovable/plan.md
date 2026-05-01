## Unify expand/collapse to "both top + bottom, same action" across Explore and Composer

### Problem

- **Explore dropdown**: Has orange "See More / See Less" in section header (works). Also has "Show N more in full search" at the bottom of external sections (redirects to search page -- wrong context for dropdown users).
- **Composer (Tag Entities)**: Has a non-functional "Show N more" button at the bottom. No header toggle at all.
- **Home SearchDialog**: Header-only toggle (already clean, no changes needed).

### Solution

Keep both top and bottom controls everywhere, but make them trigger the same inline expand/collapse action. No redirects, no dead buttons.

---

### 1. Explore page (`src/pages/Explore.tsx`)

**Bottom button for external categories (lines ~740-752):** Replace the "Show N more in full search" redirect with an inline expand/collapse toggle. When collapsed, show "See N more results" in orange. When expanded, show "See less" in orange. Both trigger the same `handleDropdownToggle(cat.key, cat.hidden.length)` that the header button already uses.

- Remove the `handleComplexProductSearch()` call
- Show the bottom button in both collapsed AND expanded states (collapsed = "See N more results", expanded = "See less")
- Style: `text-brand-orange font-medium text-xs`, centered, with ChevronDown/ChevronUp icon

**No changes to the header button** -- it stays exactly as-is.

### 2. Tag Entities composer (`src/components/feed/UnifiedEntitySelector.tsx`)

**Add expand/collapse state:**
- Add `dropdownShowAll` state (`Record<string, boolean>`), reset when `searchQuery` changes
- Add `handleDropdownToggle` callback (same pattern as Explore)

**Add orange header button to `renderSectionHeader`:**
- For both `isModal` and default variants, add an orange "See More / See Less" `Button` with ChevronDown/ChevronUp when `hiddenCount > 0`
- Pass `categoryKey` and `hiddenCount` params to `renderSectionHeader` (currently only receives `title`, `count`, `isFirst`)

**Update item rendering (lines ~794-816):**
- When `dropdownShowAll[cat.key]` is true, render `cat.allItems` instead of `cat.visible`

**Replace dead bottom button (lines ~818-829):**
- When collapsed and `cat.hidden.length > 0`: show "See N more results" in orange
- When expanded: show "See less" in orange
- Both call `handleDropdownToggle(cat.key, cat.hidden.length)`
- Style matches Explore: `text-brand-orange font-medium text-xs`, centered

**Add imports:** `ChevronDown`, `ChevronUp` from lucide-react; `Button` from `@/components/ui/button`

### 3. Home SearchDialog (`EnhancedSearchInput.tsx`)

No changes. It already uses header-only toggles and has no bottom buttons.

---

### Final behavior summary

| Surface | Header button | Bottom button |
|---------|--------------|---------------|
| Explore | "See More / See Less" (orange, existing) | "See N more results / See less" (orange, same action) |
| Composer | "See More / See Less" (orange, new) | "See N more results / See less" (orange, replaces dead button) |
| Home | "See All / See Less" (existing) | None (no change) |

Both buttons in each section toggle the same boolean state. No redirects, no dead buttons, consistent wording and styling.
