

# Phase 3B Completion: Fix 3 Remaining `/profile/` Links

## What to Do

Fix 3 components that have username data available but still navigate to `/profile/${userId}`:

### 1. `src/components/profile/modals/UserListModal.tsx`
- `handleUserClick` (line ~140) currently does `navigate('/profile/${userId}')`
- User objects have `.username` available (confirmed at line 174)
- Fix: `navigate(user.username ? '/u/${user.username}' : '/profile/${userId}')`

### 2. `src/components/entity/EntityRecommendationModal.tsx`
- `handleUserClick` (line ~103) currently does `navigate('/profile/${userId}')`
- Recommender objects have `.username` available (confirmed at line 214)
- Fix: same pattern -- use `/u/${username}` when available

### 3. `src/components/profile/ProfileCircles.tsx`
- `handleNavigateToProfile` (line 36) currently does `navigate('/profile/${userId}')`
- Update signature to accept optional username parameter: `(userId: string, username?: string)`
- Fix: `navigate(username ? '/u/${username}' : '/profile/${userId}')`
- Update `onNavigate` calls in FollowersList/FollowingList to pass username

## What to Leave As-Is (Acceptable Fallback)

- `NotificationDrawer.tsx` and `NotificationPopover.tsx` -- notification payloads only contain UUID, not username. The `/profile/${id}` fallback is correct; `Profile.tsx` handles the redirect.

## Post-Fix: Repo-Wide Audit

After the 3 fixes, search for remaining `/profile/` patterns and confirm only acceptable uses remain (fallbacks where username is unavailable, and the `Profile.tsx` redirect handler itself).

