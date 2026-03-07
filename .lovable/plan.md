

# Fix Profile Tab Double-Load — Final Plan

## On the feedback

**ChatGPT: "Use auth metadata instead of a query"** — Not safe. The username lives in the `profiles` table and can change independently of `user_metadata`. Using `user_metadata?.username` would show stale data after username changes. The `useQuery` with `['profile-username']` is the right approach — it has a 5-minute staleTime and shares cache with `ProfileRedirect.tsx` which already uses the same query key. After first load, it's instant from cache. No extra DB call in practice.

**Codex: "encodeURIComponent the username"** — Skip. Usernames are validated to be URL-safe (alphanumeric, dots, underscores). Encoding would produce ugly URLs like `/u/hana%2Eli` for no benefit.

No changes to the plan. Both suggestions sound reasonable in isolation but don't apply to this codebase.

## Plan (3 files)

### 1. Create `src/utils/getProfileUrl.ts`
```ts
export function getProfileUrl(username?: string | null): string {
  return username ? `/u/${username}` : '/profile';
}
```

### 2. Update `src/components/NavBarComponent.tsx`
- Add `useQuery(['profile-username', user?.id])` (same cache key as `ProfileRedirect.tsx` — shares cached data)
- Build navItems with dynamic Profile URL via `getProfileUrl(username)`
- Update `isProfilePage` to also match `/u/` routes
- Update active tab detection for `/u/` routes

### 3. Update `src/components/navigation/BottomNavigation.tsx`
- Same username query + `getProfileUrl` for Profile link
- Update `isActive` detection for Profile to match `/u/` routes

3 files touched (1 new, 2 updated). `/profile` route stays as fallback.

