

# Fix: Entity Page Normal Reviews — Final

## ChatGPT's Suggestion: Add first_name/last_name fallback in ReviewCard

**My assessment: Not needed.** Line 63 already has a solid fallback chain:
```
review.user.displayName || review.user.username || 'Unknown User'
```

The `displayName` is built upstream in services from `first_name + last_name`. Adding raw `first_name`/`last_name` handling inside ReviewCard would duplicate service-layer logic and couple the component to database schema. The defensive fallback to `username` is already there.

## Plan (unchanged — ready to implement)

### `src/components/entity-v4/ReviewsSection.tsx` — 1 file

1. **Line ~157**: Replace `regularReviews.slice(0, 3).map(transformReviewForUI)` with `regularReviews.slice(0, 3)` (raw data)
2. **Line ~514**: Pass `review` instead of `transformReviewForUI(review)` for circle reviews
3. **Lines ~531-538**: Update variable name from `transformedRegularReviews` to `displayRegularReviews`

No hover changes. No other files. Pure frontend.

