

# Fix: Centralize Display-Name Logic — Final Plan

Both reviewers approve. Adding one verification step they both flagged.

## Changes

### 1. Fix `src/utils/profileUtils.ts` — flip name priority + fix username corruption

**`getDisplayName` (line 86-92):** Change priority from `username → real name` to `real name → username`:
```
[first_name, last_name].filter(Boolean).join(' ') || username || 'Anonymous User'
```

**`transformToSafeProfile` (line 29-48):**
- Same priority fix for `displayName`
- **Critical fix line 48:** `username: displayName` → `username: profile.username || PROFILE_FALLBACKS.username` — preserves the real handle for routing
- Fix initials to prioritize real name over username (lines 34-40)

**`getUserInitials` (line 98+):** Same priority flip — real name initials first.

### 2. Migration: Add `first_name`, `last_name` to `get_who_to_follow` RPC

DROP + CREATE with updated RETURNS TABLE adding `first_name text, last_name text`. Add `p.first_name, p.last_name` to all CTE SELECT branches (friends_of_friends, active_creators, new_users, popular_users, fallback).

### 3. Update `src/services/userRecommendationService.ts`

- Add `first_name`, `last_name` to `RecommendedUser` interface
- Map from RPC response
- Fix `displayName`: `[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Anonymous User'`
- Same fix in `getFallbackRecommendations` — add `first_name, last_name` to profiles SELECT

### 4. Update `src/components/explore/UserDirectoryList.tsx`

- Add `first_name, last_name` to profiles SELECT and `User` type
- Card title: real name with fallback
- Add `@username` as secondary text below the name

### 5. Update `src/integrations/supabase/types.ts`

Add `first_name`, `last_name` to `get_who_to_follow` return type.

### 6. Verification step (post-implementation)

Confirm these routing/linking paths still use the real username handle (not displayName):
- `UserListModal.tsx` line 141: `/u/${userProfile.username}`
- `MutualConnectionsProof.tsx` line 101: `/u/${mutual.username}`
- `FollowersList.tsx` / `FollowingList.tsx`: `onNavigate` callbacks
- `UsernameLink.tsx`: receives username prop

The `transformToSafeProfile` fix on line 48 is the key — once `username` preserves the real handle, all downstream routing stays correct.

## Files

| File | Change |
|------|--------|
| `src/utils/profileUtils.ts` | Fix priority + username corruption |
| `supabase/migrations/[new].sql` | Add name fields to `get_who_to_follow` |
| `src/services/userRecommendationService.ts` | Map name fields, fix displayName |
| `src/components/explore/UserDirectoryList.tsx` | Fetch + display real names |
| `src/integrations/supabase/types.ts` | Update RPC types |

## Not changing
- `UserCard.tsx` — already fixed
- Circles RPCs — already fixed in previous migration
- Entity surfaces — already correct
- `UserRecommendationCard.tsx` — already uses `displayName` from service

