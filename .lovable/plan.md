

# Plan: Remove Save from Reviews/Recommendations, Simplify Saved Tab

## Changes

### 1. `src/hooks/use-saved-items.ts`
- Remove all `review_saves` and `recommendation_saves` query logic
- Remove `'review'` and `'recommendation'` from `SavedItemType`
- Remove `unsaveReview` and `unsaveRecommendation` mutations
- Only query `post_saves` and `entity_saves`

### 2. `src/components/mystuff/SavedItemsSection.tsx`
- Remove Reviews and Recommendations filter chips
- Update filters to: All | Posts | Places & Products
- Remove `SavedReviewCard` and `SavedRecommendationCard` imports and case branches
- Update empty state text

### 3. Delete unused components
- Delete `src/components/mystuff/saved/SavedReviewCard.tsx`
- Delete `src/components/mystuff/saved/SavedRecommendationCard.tsx`

### 4. Remove save/bookmark button from ReviewCard
- `src/components/profile/reviews/ReviewCard.tsx` — remove `onSave` prop, Bookmark button, related state

### 5. Remove save/bookmark button from RecommendationCard
- `src/components/recommendations/RecommendationCard.tsx` — remove `onSave` prop, `isSaved` state, `handleSave`, Bookmark button

### 6. Remove save from RecommendationFeedItem
- `src/components/feed/RecommendationFeedItem.tsx` — remove `onSave`, `handleSave`, Bookmark button

### 7. Remove save from RecommendationContentViewer
- `src/components/content/RecommendationContentViewer.tsx` — remove recommendation save logic and `onSave` prop passing

### 8. Update callers passing `onSave` for reviews/recommendations
- `src/pages/EntityDetailV2.tsx`, `src/pages/EntityDetail.tsx` — remove `onSave` from ReviewCard usage

### No database changes
Tables `review_saves` and `recommendation_saves` stay in DB (harmless), just no longer queried.

