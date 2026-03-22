

# Standardize Avatar Fallbacks: Color + Initials — Final Plan

Both reviewers approve. One valid refinement from Codex incorporated.

## Codex's refinement: first + last word initials ✅ Adding

Good catch. For "Rishabh Kumar Sr" → should be "RS" (first+last), not "RK" (first+second). Updated helper:

```ts
export const getInitialsFromName = (name: string | null | undefined): string => {
  if (!name) return PROFILE_FALLBACKS.initials;
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};
```

Only change: `parts[1]` → `parts[parts.length - 1]`.

## ChatGPT's suggestions — not adding

- **`<AvatarFallbackStandard>` wrapper**: Unnecessary abstraction. The pattern is simple enough (`getInitialsFromName` + two CSS classes). A wrapper for two props adds indirection without meaningful protection.
- **Lint rule**: Good idea in theory but not actionable right now — ESLint can't easily distinguish "raw AvatarFallback that should use ProfileAvatar" from intentional usage. Not worth the effort.

## Everything else unchanged from previous plan

### Step 1: Add `getInitialsFromName` to `src/utils/profileUtils.ts`

With the first+last word fix above.

### Step 2: Fix 13 files

| File | Initials Fix | Color Fix |
|------|-------------|-----------|
| `ReviewTimelineViewer.tsx` | Swap to `getInitialsFromName` | Add `bg-brand-orange text-white` |
| `profile/reviews/ReviewCard.tsx` | Swap to helper | Add orange |
| `ReviewCard.tsx` (entity) | Swap to helper | Already orange ✅ |
| `TimelineReviewCard.tsx` | Swap to helper | Already orange ✅ |
| `PostFeedItem.tsx` | Swap to helper | Add orange |
| `ProfilePostItem.tsx` | Swap to helper | Add orange |
| `SavedPostCard.tsx` | Swap to helper | Add orange |
| `CommentDialog.tsx` | Swap to helper | Add orange |
| `UserDirectoryList.tsx` | Swap to helper | Add orange |
| `EnhancedCreatePostForm.tsx` | Swap to helper | Already orange ✅ |
| `PublicProfileView.tsx` | Already 2-char | `bg-primary` → `bg-brand-orange text-white` |
| `vertical-tubelight-navbar.tsx` | Already 2-char | Add orange |

### Step 3: Remove all local `getInitials` functions

No migration. Pure frontend. 13 files + 1 utility.

