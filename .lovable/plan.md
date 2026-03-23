

# Fix: Inline Username Layout + Complete Twitter/X Model Rollout

## Two Issues Found

### Issue 1: Layout — Username is below display name, should be inline
Currently `UsernameLink` uses `flex-col` (vertical stack):
```
Rishabh Sr
@rishab.devp
```

User wants Twitter-style **inline**:
```
Rishabh Sr  @rishab.devp
```

### Issue 2: Several surfaces still NOT using the displayName + @username pattern

| Surface | File | Status | Problem |
|---------|------|--------|---------|
| Feed posts | `PostFeedItem.tsx` | ✅ Uses displayName prop | Layout wrong (vertical) |
| Feed recommendations | `RecommendationFeedItem.tsx` | ✅ Uses displayName prop | Layout wrong (vertical) |
| Profile posts | `ProfilePostItem.tsx` | ✅ Uses displayName prop | Layout wrong (vertical) |
| Saved posts | `SavedPostCard.tsx` | ✅ Uses displayName prop | Layout wrong (vertical) |
| Comments | `CommentDialog.tsx` | ✅ Uses displayName prop | showHandle=false, OK for compact |
| Profile ReviewCard (compact) | `profile/reviews/ReviewCard.tsx` L366 | ❌ Uses `fallback` prop, not `displayName` | Shows username as name |
| Profile ReviewCard (full) | `profile/reviews/ReviewCard.tsx` L520 | ❌ Uses `fallback` prop, not `displayName` | Shows username as name |
| Entity ReviewCard | `ReviewCard.tsx` L93 | ❌ Plain `<h4>` with name, no link, no @username | Not linked, no handle |
| TimelineReviewCard | `TimelineReviewCard.tsx` L233 | ❌ Plain `<h4>` with name, no link, no @username | Not linked, no handle |
| Timeline modal | `ReviewTimelineViewer.tsx` L282, L348 | ❌ Plain `<span>` with name, no link | Not linked, no handle |
| ProfileDisplay | `ProfileDisplay.tsx` | ⚠️ Uses displayName but showHandle=false | OK for compact usage |

## Plan

### Step 1: Fix `UsernameLink` layout — vertical → inline

Change the `displayName` rendering from `flex-col` to `flex items-center gap-1.5` (inline). The @username goes next to the display name on the same line, not below.

```
Before: flex flex-col
After:  flex items-baseline gap-1.5 flex-wrap
```

### Step 2: Fix Profile ReviewCard (2 variants)

**Line 366 (compact):** Change from `fallback={displayName}` pattern to proper `displayName` + `showHandle` props.

**Line 520 (full):** Same fix — use `displayName` prop instead of `fallback`.

### Step 3: Fix Entity ReviewCard (`ReviewCard.tsx`)

Replace plain `<h4>{transformedReview.name}</h4>` with `UsernameLink` using `displayName` and `username`. Need to pass `username` and `userId` through from the `ReviewWithUser` type.

### Step 4: Fix TimelineReviewCard (`TimelineReviewCard.tsx`)

Replace plain `<h4>{transformedReview.name}</h4>` with `UsernameLink` using `displayName` and `username`.

### Step 5: Fix Timeline modal (`ReviewTimelineViewer.tsx`)

Replace plain `<span>{initialReviewName}</span>` and `<span>{updateName}</span>` with `UsernameLink` components.

## Files Changed

| File | Change |
|------|--------|
| `UsernameLink.tsx` | `flex-col` → `flex items-baseline gap-1.5 flex-wrap` |
| `profile/reviews/ReviewCard.tsx` | Use `displayName` prop (2 places) |
| `ReviewCard.tsx` | Add `UsernameLink` with displayName |
| `TimelineReviewCard.tsx` | Add `UsernameLink` with displayName |
| `ReviewTimelineViewer.tsx` | Add `UsernameLink` with displayName |

5 files. Pure frontend. No migration.

