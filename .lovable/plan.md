

# Fix: Display Real Names in Circles — Final Plan

Previous plan plus one addition from both reviewers:

## Addition: Explicit fallback rule in `UserCard.tsx`

```text
Display name logic:
1. first_name + last_name (if either exists) → "Hana Li" or "Hana"
2. else username → "hana.li"
3. else "User"

Secondary line:
- @username if username exists
- hidden if no username
```

Filter out `null`/empty strings before concatenation to prevent "Hana null" or " Li".

## Everything else unchanged

1. **Migration**: Add `first_name`, `last_name` to both `get_followers_with_profiles` and `get_following_with_profiles` RPCs
2. **`types.ts`**: Add `first_name`, `last_name` to `UserProfile`
3. **`circleService.ts`**: Map the new fields
4. **`UserCard.tsx`**: Accept `firstName`/`lastName`, apply fallback rule above
5. **Callers** (`FollowersList`, `FollowingList`, `UserListModal`): Pass new props
6. **Supabase types**: Update RPC return types

## Files

| File | Change |
|------|--------|
| `supabase/migrations/[new].sql` | Add columns to both RPCs |
| `src/components/profile/circles/types.ts` | Add name fields |
| `src/components/profile/circles/api/circleService.ts` | Map name fields |
| `src/components/profile/circles/UserCard.tsx` | Fallback display logic |
| `src/components/profile/circles/FollowersList.tsx` | Pass props |
| `src/components/profile/circles/FollowingList.tsx` | Pass props |
| `src/components/profile/modals/UserListModal.tsx` | Pass props |
| `src/integrations/supabase/types.ts` | Update RPC types |

