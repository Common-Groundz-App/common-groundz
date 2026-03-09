

# Fix 3 Remaining Cleanup Items

## Files to change (3)

### 1. `src/services/recommendation/interactionOperations.ts`
- Delete `toggleRecommendationSave` (lines 9-11) and `toggleSave` (lines 52-81)
- Keep `toggleRecommendationLike` and `toggleLike` (still active)

### 2. `src/services/entityService.ts`
**Recommendations section (~lines 148-211):**
- Remove `savedIds` variable (line 149)
- Remove `recommendation_saves` query from Promise.all (lines 160-164)
- Remove `savedIds` set creation (line 172)
- Remove `isSaved: savedIds.has(rec.id)` from mapping (line 211) — remove entirely, not set to false

**Reviews section (~lines 288-356):**
- Remove `savedIds` variable (line 290)
- Remove `review_saves` query from Promise.all (lines 301-305)
- Remove `savedIds` set creation (line 313)
- Remove `isSaved: savedIds.has(rev.id)` from mapping (line 356) — remove entirely, not set to false

### 3. `src/hooks/recommendations/use-recommendation-actions.ts`
- Line 77: Remove `'isSaved'` from the `Omit` type (it no longer exists on `Recommendation`)

## Verified: No other stragglers
Remaining `isSaved` references are all for posts (`PostFeedItem`, `postService`, `posts/processor`) or entities (`use-entity-save`, `EntityV3Header`, `JourneyRecommendationCard`) — all correct and untouched.

