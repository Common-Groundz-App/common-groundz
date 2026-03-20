

# Verification: Centralize Display-Name Logic

## Plan Implementation Status: ✅ Correctly Implemented

All 5 planned changes were applied correctly:

| Planned Change | Status |
|---|---|
| `profileUtils.ts` — priority flipped, username preserved | ✅ Done correctly |
| `get_who_to_follow` RPC — `first_name`, `last_name` added | ✅ Migration applied |
| `userRecommendationService.ts` — real name display | ✅ Done correctly |
| `UserDirectoryList.tsx` — real name + @username | ✅ Done correctly |
| `UserRecommendationCard.tsx` — displayName + @username | ✅ Done correctly |

## Remaining Surfaces Still Using Username as Display Name

These were NOT part of the plan but still have the old pattern:

### 1. `ReviewTimelineViewer.tsx` (lines 283, 347)
Shows `username || 'User'` as the author name on review timeline entries. Should use `first_name`/`last_name` from the joined profiles data.

### 2. `networkRecommendationService.ts` (line 231)
Sets `displayName: username` — the network recommendation RPC only returns usernames, not real names. The displayed recommender names in network-sourced feed items will be handles, not real names.

### 3. `posts/processor.ts` (line 37)
Uses `profile?.displayName || profile?.username` — this one is actually fine since `displayName` from `SafeUserProfile` now has the correct priority. ✅ No fix needed.

### 4. `RecommendationContentViewer.tsx` (line 136) + `PostContentViewer.tsx` (line 153)
Both set `username: authorProfile.displayName || authorProfile.username` — these are also fine since `authorProfile.displayName` now correctly prioritizes real names via the fixed `transformToSafeProfile`. ✅ No fix needed.

### 5. `CircleContributorsPreview.tsx` (line 96) + `ContributorModal.tsx` (line 120)
Use `profile?.displayName || profile?.username` — fine since these use `SafeUserProfile`. ✅ No fix needed.

## Actual Fixes Needed

Only **2 surfaces** still need fixing:

### Fix 1: `ReviewTimelineViewer.tsx`
The review and timeline update queries join `profiles` but only use `.username`. Need to also pull `first_name`/`last_name` and display real names.

### Fix 2: `networkRecommendationService.ts`
The network recommendation RPC returns `recommender_usernames` but no real name fields. The service sets `displayName: username`. This needs the RPC to also return `first_name`/`last_name` arrays, or at minimum the service should look up names from the profile data it already has.

## Verification Checklist

Test these as logged-in user (rishab.devp):

1. **Home page — Who to Follow sidebar**: Cards should show "Hana Li" (not "hana.li") with @hana.li below
2. **Explore — People tab**: Cards should show real names with @username below + mutual avatars
3. **Profile — Followers modal**: Real name primary, @username secondary
4. **Profile — Following modal**: Same
5. **Profile — Circles tab**: Same
6. **Profile header — Mutual proof**: "Followed by Hana" (not "hana.li")
7. **Entity page — Social followers**: "Followed by Hana and 2 others you follow"
8. **Routing**: Clicking any name should navigate to `/u/{username}` (not `/u/{display name}`)
9. **Users without real names**: Should gracefully show username as primary, no @username secondary line
10. **Own profile**: Should show your real name, not username

