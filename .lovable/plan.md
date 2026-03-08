
# Phase 3: Complete Cleanup of Review/Recommendation Save Logic — IMPLEMENTED

## Status: ✅ Complete

All review/recommendation save logic has been removed. Saving is now only supported for **posts** and **entities**.

## Changes Made (17 files)

### Group A: Removed `handleSave` from hooks
1. **`src/hooks/use-reviews.ts`** — Removed `toggleReviewSave` import, deleted `handleSave`, removed from return
2. **`src/hooks/use-recommendations.ts`** — Removed `toggleReviewSave` import, deleted `handleSave`, removed from return
3. **`src/hooks/recommendations/use-recommendation-actions.ts`** — Removed `toggleSave` import, deleted `handleSave`, removed from return
4. **`src/hooks/recommendations/use-recommendations.ts`** — Removed `toggleSave` import, deleted `handleSave`, removed from return

### Group B: Removed `handleSave` from callers
5. **`src/components/profile/ProfileReviews.tsx`** — Removed `handleSave` from destructuring
6. **`src/components/profile/ProfileRecommendations.tsx`** — Removed `handleSave` from destructuring

### Group C: Feed save guard — safe no-op
7. **`src/hooks/feed/interactions.ts`** — Removed `toggleRecommendationSave` import. Added guard: only posts can be saved (`console.error` + `return false`)
8. **`src/hooks/feed/use-infinite-feed.ts`** — Added early return in `handleSave` if item is not a post

### Group D: Cleaned interaction cache
9. **`src/hooks/use-user-interactions-cache.ts`** — Removed `savedRecommendations`, `savedReviews`, and their queries. `isSaved` now only accepts `'post'` type

### Group E: Unused import
10. **`src/components/profile/reviews/ReviewCard.tsx`** — Removed `Bookmark` from lucide-react import

### Group F: Stopped fetching `isSaved` in services
11. **`src/services/review/fetch.ts`** — Removed `get_user_review_saves` RPC, removed `isSaved` mapping
12. **`src/services/reviewService.ts`** — Removed `toggleReviewSave` function, removed save queries, removed `isSaved` from Review interface
13. **`src/services/review/interactions.ts`** — Deleted `toggleReviewSave` function
14. **`src/services/recommendation/fetchRecommendations.ts`** — Removed `recommendation_saves` query, `isSaved` mapping
15. **`src/services/recommendation/fetchRecommendationById.ts`** — Removed `recommendation_saves` query, `isSaved` mapping
16. **`src/services/recommendation/interactionOperations.ts`** — Deleted `toggleSave`/`toggleRecommendationSave`
17. **`src/hooks/feed/api/recommendations.ts`** — Removed `recommendation_saves` queries
18. **`src/hooks/feed/api/recommendations/interactions.ts`** — Deleted `toggleRecommendationSave`
19. **`src/services/recommendationService.ts`** — Removed `toggleSave` export

### Group G: Type cleanup
- **`src/services/reviewService.ts`** — Removed `isSaved` from `Review` interface
- **`src/services/recommendation/types.ts`** — Removed `isSaved` from `Recommendation` interface
- **`src/types/common.ts`** — Made `isSaved` optional in `InteractionData` interface
- **`src/hooks/useCircleReviews.ts`** — Removed `isSaved: false` from mapping

### No database changes
Tables `review_saves` and `recommendation_saves` remain in DB (harmless, no longer queried).
