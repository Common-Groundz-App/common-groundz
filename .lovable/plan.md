

# Final Plan: Complete Cleanup of Review/Recommendation Save Logic

Agreed with both ChatGPT and Codex. The only change from the previous plan: use `console.error` + `return false` instead of `throw` in the feed save guard.

## All changes (17 files, Groups A–G)

### Group A: Remove `handleSave` from hooks (3 files)
1. **`src/hooks/use-reviews.ts`** — Remove `toggleReviewSave` import, delete `handleSave`, remove from return
2. **`src/hooks/use-recommendations.ts`** — Remove `toggleReviewSave` import, delete `handleSave`, remove from return
3. **`src/hooks/recommendations/use-recommendation-actions.ts`** — Remove `toggleSave` import, delete `handleSave`, remove from return

### Group B: Remove `handleSave` from callers (2 files)
4. **`src/components/profile/ProfileReviews.tsx`** — Remove `handleSave` from destructuring
5. **`src/components/profile/ProfileRecommendations.tsx`** — Remove `handleSave` from destructuring

### Group C: Feed save guard — safe no-op (2 files)
6. **`src/hooks/feed/interactions.ts`** — Remove `toggleRecommendationSave` import. Guard both `toggleFeedItemSave` and `useInteractions.handleSave`:
```typescript
if (!isItemPost(item)) {
  console.error('Save attempted on unsupported item type:', item.type);
  return false;
}
```
7. **`src/hooks/feed/use-infinite-feed.ts`** — Early return in `handleSave` if item is not a post

### Group D: Clean interaction cache (1 file)
8. **`src/hooks/use-user-interactions-cache.ts`** — Remove `savedRecommendations`, `savedReviews`, and their queries. Update `isSaved` to only accept `'post'`

### Group E: Unused import (1 file)
9. **`src/components/profile/reviews/ReviewCard.tsx`** — Remove `Bookmark` from lucide-react import

### Group F: Stop fetching `isSaved` in services (8 files)
10. **`src/services/review/fetch.ts`** — Remove `get_user_review_saves` RPC, remove `isSaved` mapping
11. **`src/services/reviewService.ts`** — Remove `toggleReviewSave` export, remove save queries
12. **`src/services/review/interactions.ts`** — Delete `toggleReviewSave` function
13. **`src/services/recommendation/fetchRecommendations.ts`** — Remove `recommendation_saves` query, `isSaved` mapping
14. **`src/services/recommendation/fetchRecommendationById.ts`** — Remove `recommendation_saves` query, `isSaved` mapping
15. **`src/services/recommendation/interactionOperations.ts`** — Delete `toggleSave`/`toggleRecommendationSave`
16. **`src/hooks/feed/api/recommendations.ts`** — Remove `recommendation_saves` query
17. **`src/hooks/feed/api/recommendations/interactions.ts`** — Delete `toggleRecommendationSave`

### Group G: Type cleanup (3 files)
- **`src/services/reviewService.ts`** — Remove `isSaved` from `Review` interface
- **`src/services/recommendation/types.ts`** — Remove `isSaved` from `Recommendation` interface
- **`src/hooks/useCircleReviews.ts`** — Remove `isSaved: false` from mapping

### No database changes
Tables stay in DB, just no longer queried.

