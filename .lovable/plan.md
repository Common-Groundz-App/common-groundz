

# Final Plan: Add "Saved" Tab to My Stuff

## Files

### 1. New: `src/hooks/use-saved-items.ts`
- Queries all 4 save tables for current user, each joining content data
- Accepts `typeFilter`: `'all' | 'post' | 'review' | 'recommendation' | 'entity'`
- Each result gets a `type` discriminator and `saved_at` from the save table's `created_at`
- **When filter is "All": merge all types into one array, globally sort by `saved_at` DESC** — this is the cross-type sort contract both reviewers flagged
- When filtering by type: only query that one table
- Pagination: limit 20 per load, with `loadMore` function
- Unsave mutations for each type with cache invalidation

### 2. New: `src/components/mystuff/SavedItemsSection.tsx`
- Filter chips: All | Posts | Reviews | Recommendations | Entities
- Renders using existing card components (`ProfilePostItem`, `ReviewCard`, `RecommendationCard`, entity card/link)
- Each item shows filled Bookmark icon for unsave
- "Load more" button when more items exist
- Empty state: Bookmark icon + "No saved items yet — Save posts, reviews, recommendations, and places to find them here."
- Loading spinner while fetching

### 3. Modified: `src/components/mystuff/MyStuffContent.tsx`
- Add 4th tab: `{ value: 'saved', label: 'Saved', icon: Bookmark }`
- Render `SavedItemsSection` inside new `TabsContent`

### No database changes needed
All 4 save tables + RLS policies already exist and work.

