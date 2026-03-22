
# Fix: Initials Using Wrong Input Data — COMPLETED ✅

## What was done

### Migration
- Updated `get_comments_with_profiles` RPC: added `first_name`, `last_name` to RETURNS TABLE and SELECT
- Hardened with `SET search_path = public`, schema-qualified table references, soft-delete filter

### Services (data layer)
- `commentsService.ts`: Added `displayName`, `first_name`, `last_name` to `CommentData`; builds displayName from name fields
- `profiles.ts` (feed hook): Added `first_name, last_name` to SELECT query
- `profilePostsService.ts`: Added `displayName` to `Post` interface; populated from profile name fields
- `use-saved-items.ts`: Added `displayName` to saved post content
- `userRecommendationService.ts`: Removed local `getInitials`, now uses shared `getInitialsFromName`

### UI Components
- `CommentDialog.tsx`: Uses `comment.displayName || comment.username` for initials; composer uses first/last name
- `ProfilePostItem.tsx`: Uses `post.displayName || post.username` for initials
- `SavedPostCard.tsx`: Uses `post.displayName || post.username` for initials

### Key principle
- `username` = raw handle (routing, mentions) — never overwritten
- `displayName` = human-readable name (UI, initials) — derived from first_name + last_name || username
- All initials use `getInitialsFromName(displayName || username)` defensive fallback
