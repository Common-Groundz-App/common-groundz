

# Fix: Initials Using Wrong Input Data — Final Plan

Plan is approved by both reviewers. No changes needed. The defensive fallback `getInitialsFromName(x.displayName || x.username)` is already part of the plan.

## Changes

### 1. Migration: Update `get_comments_with_profiles` RPC
Add `first_name text` and `last_name text` to RETURNS TABLE and SELECT.

### 2. `src/services/commentsService.ts`
- Add `displayName` and optionally `first_name`/`last_name` to `CommentData` interface
- Build `displayName: [comment.first_name, comment.last_name].filter(Boolean).join(' ') || comment.username || 'Unknown user'`

### 3. `src/components/comments/CommentDialog.tsx`
- Expand `userProfile` state type to include `first_name`, `last_name`
- Composer avatar: `getInitialsFromName([userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || userProfile?.username)`
- Comment list: `getInitialsFromName(comment.displayName || comment.username)`

### 4. `src/hooks/feed/api/profiles.ts`
Add `first_name, last_name` to the SELECT query.

### 5. `src/components/profile/services/profilePostsService.ts`
- Add `displayName?: string` to `Post` interface
- Populate: `displayName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || null`
- Keep `username` as raw handle

### 6. `src/components/profile/ProfilePostItem.tsx`
- Use `getInitialsFromName(post.displayName || post.username)` for avatar fallback

### 7. `src/hooks/use-saved-items.ts`
- Add `displayName` to saved post content: `[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username`

### 8. `src/components/mystuff/saved/SavedPostCard.tsx`
- Use `getInitialsFromName(post.displayName || post.username)` for avatar fallback

### 9. `src/services/userRecommendationService.ts`
- Delete local `getInitials` function (lines 111-119)
- Import `getInitialsFromName` from `@/utils/profileUtils`
- Replace calls on lines 41 and 83

## Summary

9 files, 1 migration. `username` is never overwritten. All initials derived from `displayName || username`.

