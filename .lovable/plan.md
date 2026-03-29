

# Fix: Uncategorized Badge & Username Display

## Changes

### 1. Hide "Uncategorized" badge — `PostFeedItem.tsx`
- Import `shouldHideCategory` from `@/services/categoryService`
- Add `!shouldHideCategory(entity.category_id)` check before rendering `EntityCategoryBadge` in `renderTaggedEntities`

### 2. Fix username/displayName mapping — `PostContentViewer.tsx`
- Change line ~147 from overwriting `username` with displayName to preserving both fields separately:
  ```ts
  displayName: authorProfile.displayName || authorProfile.username,
  username: authorProfile.username,
  ```

Two small, targeted fixes. No other files or layout changes.

