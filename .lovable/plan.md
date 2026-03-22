

# Fix: Timeline Modal Display Names — Final Plan (No Changes Needed)

Both reviewers approve. ChatGPT's suggestion to add `first_name`/`last_name` fallback in `updateName` is **not applicable** — `ReviewUpdate.profiles` only contains `username` and `avatar_url`, no name fields. The `update.user.displayName` already resolves correctly via `transformToSafeProfile`.

The plan stands as previously approved. Implement it as-is.

## Changes: `src/components/profile/reviews/ReviewTimelineViewer.tsx`

### Local variables for clean fallback

**Initial review (before line ~270):**
```ts
const initialReviewName = reviewData?.user?.displayName || reviewData?.user?.username || 'User';
```

**Update entries (inside map, before line ~337):**
```ts
const updateName = update.user?.displayName || update.profiles?.username || 'User';
```

### Line changes

| Line | Current | New |
|------|---------|-----|
| 276 | `getInitials(reviewData?.user?.username \|\| null)` | `getInitials(initialReviewName)` |
| 283 | `reviewData?.user?.username \|\| 'User'` | `initialReviewName` |
| 338 | `update.profiles?.avatar_url` | `update.user?.avatar_url \|\| update.profiles?.avatar_url` |
| 340 | `getInitials(update.profiles?.username \|\| null)` | `getInitials(updateName)` |
| 347 | `update.profiles?.username \|\| 'User'` | `updateName` |

One file. ~10 lines changed. No migration.

