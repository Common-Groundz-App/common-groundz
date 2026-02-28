

# Phase 3: noindex on Private Pages + Internal Link Cleanup

No changes from the previously approved plan. All feedback from ChatGPT and Codex is either already handled or already included.

## Confirmation of Feedback Items

| Feedback | Status |
|----------|--------|
| NotFound.tsx: noindex without canonical | Already in plan. SEOHead renders no canonical when none is passed. |
| /auth should be noindex | Already in plan. Auth is a utility page, not a landing page. |
| Post-migration /profile/ audit | Already in plan as verification step. |
| Migration completion gate | Same as audit step above. |

## Part A: Add noindex to Private and Utility Pages (11 files)

Add `<SEOHead noindex={true} title="[Page] -- Common Groundz" />` to:

1. `src/pages/Feed.tsx` -- /home
2. `src/pages/Settings.tsx` -- /settings
3. `src/pages/MyStuffPage.tsx` -- /my-stuff
4. `src/pages/SavedInsights.tsx` -- /saved-insights
5. `src/pages/YourData.tsx` -- /your-data
6. `src/pages/Search.tsx` -- /search
7. `src/pages/Auth.tsx` -- /auth (confirmed: noindex is correct, this is a utility page)
8. `src/pages/CompleteProfile.tsx` -- /complete-profile
9. `src/pages/AdminPortal.tsx` -- /admin
10. `src/pages/Explore.tsx` -- /explore
11. `src/pages/NotFound.tsx` -- catch-all 404 (noindex, NO canonical)

Each is a single SEOHead import + one-line addition. No logic changes.

## Part B: Internal Link Cleanup

Update internal profile links to use `/u/${username}` when username is available, falling back to `/profile/${userId}` when not.

### Priority 1: Shared link primitives

1. **`src/components/common/UsernameLink.tsx`** -- Change `to` from `/profile/${userId}` to `/u/${username}` when username prop exists. This cascades to all consumers (PostFeedItem, RecommendationFeedItem, ProfileDisplay, ReviewCard, etc.)

### Priority 2: Direct navigate/Link calls

2. `src/components/search/UserResultItem.tsx`
3. `src/components/recommendations/CircleContributorsPreview.tsx`
4. `src/components/recommendations/ContributorModal.tsx`
5. `src/components/entity/EntityFollowerModal.tsx`
6. `src/components/entity/EntitySocialFollowers.tsx`
7. `src/components/notifications/NotificationDrawer.tsx`
8. `src/components/ProfileRedirect.tsx`

Fallback: Components with only `userId` (no username) keep using `/profile/${userId}`. The client-side redirect in `Profile.tsx` handles forwarding.

## Part C: Post-Migration Verification

After implementation, run a codebase search for `/profile/` link patterns. Only acceptable remaining uses:
- Fallback navigation (when username is unavailable)
- The redirect handler in `Profile.tsx`
- No primary link usage

Manual test: click profile links from feed, notifications, entity followers, search results, and recommendation contributors -- all should resolve to `/u/:username`.

## What Is NOT Changed

- No database or RLS changes
- No changes to public pages (Phase 1 and 2 work)
- No changes to AppProtectedRoute
- No routing changes in App.tsx
- No changes to authenticated user functionality
