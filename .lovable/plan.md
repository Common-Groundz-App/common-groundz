

# Implement Plan: Fix Initials Using Wrong Input Data

All reviews complete. Proceeding with the approved 9-file plan, using the security-hardened SQL from ChatGPT's review.

## Step 1: Migration — hardened `get_comments_with_profiles`

Use ChatGPT's corrected SQL exactly:
- `SET search_path = public`
- `public.%I` / `public.profiles` schema-qualified references
- `first_name text`, `last_name text` added to RETURNS TABLE + SELECT
- `AND (p.deleted_at IS NULL OR p.id IS NULL)` filter added

## Step 2: `src/services/commentsService.ts`
- Add `displayName`, `first_name`, `last_name` to `CommentData` interface
- Build `displayName` from name fields in `fetchComments`

## Step 3: `src/components/comments/CommentDialog.tsx`
- Use `comment.displayName || comment.username` for initials in comment list
- Build composer display name from `userProfile` first/last name fields

## Step 4: `src/hooks/feed/api/profiles.ts`
- Add `first_name, last_name` to SELECT query

## Step 5: `src/components/profile/services/profilePostsService.ts`
- Add `displayName?: string` to `Post` interface
- Populate `displayName` from profile name fields, keep `username` as handle

## Step 6: `src/components/profile/ProfilePostItem.tsx`
- Use `getInitialsFromName(post.displayName || post.username)` for avatar

## Step 7: `src/hooks/use-saved-items.ts`
- Add `displayName` to saved post content from profile name fields

## Step 8: `src/components/mystuff/saved/SavedPostCard.tsx`
- Use `getInitialsFromName(post.displayName || post.username)` for avatar

## Step 9: `src/services/userRecommendationService.ts`
- Delete local `getInitials`, import shared `getInitialsFromName`

9 files + 1 migration. `username` never overwritten. Security-hardened RPC.

