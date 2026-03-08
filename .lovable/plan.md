

# Final Plan — No More Changes Needed

Both suggestions are minor and already handled:

**ChatGPT "self-redirect guard in ProfileRedirect"** — Not needed. `ProfileRedirect` uses `<Navigate replace />` which replaces the history entry. It only triggers when the user hits `/profile`, and it redirects to `/u/:username`. There's no loop risk because `/u/:username` renders `UserProfile`, not `ProfileRedirect`.

**Codex "signed-out fallback"** — Already handled. All nav components using the hook are inside `AppProtectedRoute`, so signed-out users never reach them. The hook will return `/profile` when there's no user, and `ProtectedRoute` catches that.

The plan has been reviewed four times now. No further changes. Ready to implement exactly as last approved:

## Files (7 total)

1. **`src/hooks/useCanonicalProfileUrl.ts`** (new) — shared hook returning `{ profileUrl, username, isLoading }`
2. **`src/App.tsx`** — `/profile` route renders `ProfileRedirect` instead of `Profile`
3. **`src/components/ProfileRedirect.tsx`** — add loading state, return `null` while username resolves
4. **`src/components/UserMenu.tsx`** — replace hardcoded `/profile` link
5. **`src/components/ui/vertical-tubelight-navbar.tsx`** — replace hardcoded `/profile` links
6. **`src/components/NavBarComponent.tsx`** — use shared hook instead of inline query
7. **`src/components/navigation/BottomNavigation.tsx`** — use shared hook instead of inline query

