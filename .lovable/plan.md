

# Fix: Reviews Still Showing Username Instead of Real Name

## Problem

The `ReviewWithUser.user` is a `SafeUserProfile` which now has a correct `displayName` field (real name first). But several review components still reference `.username` directly instead of `.displayName`.

## Affected locations

### 1. `src/utils/reviewDataUtils.ts` (line 7)
```
name: review.user.username || 'Unknown User'
```
Should be: `review.user.displayName || review.user.username || 'Unknown User'`

### 2. `src/components/ReviewCard.tsx` (line 64)
```
name: review.user.username || 'Unknown User'
```
Same fix.

### 3. `src/components/entity-v4/ReviewsSection.tsx` (lines 496, 510, 527)
Uses `review.user.username` for `circleUserName` prop and "you follow reviewed this" copy. Should use `review.user.displayName`.

### 4. `src/components/entity-v4/TimelineReviewCard.tsx` (line 221)
Uses `circleUserName` (which receives username from above). Already fixed once the prop is fixed upstream.

### 5. `src/components/profile/reviews/ReviewCard.tsx` (lines 368, 517, 522)
Uses `review.user?.username` for `UsernameLink` label and avatar alt text. The `UsernameLink` should show `displayName` as label text while keeping `username` for routing.

## Changes

| File | Change |
|------|--------|
| `src/utils/reviewDataUtils.ts` | Line 7: use `displayName` |
| `src/components/ReviewCard.tsx` | Line 64: use `displayName` |
| `src/components/entity-v4/ReviewsSection.tsx` | Lines 496, 510, 527: use `displayName` for display, keep `username` only for routing |
| `src/components/profile/reviews/ReviewCard.tsx` | Lines 368, 517, 522: use `displayName` for visible text, keep `username` for `UsernameLink` routing |

No migration needed. No new files. Pure frontend fix using data already available in `SafeUserProfile`.

