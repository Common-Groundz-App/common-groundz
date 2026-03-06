

# Fix: Consistent Navbar in EntityV4LoadingWrapper

## Both suggestions are valid. Here's the refined plan:

### ChatGPT's auth-loading fallback — **Yes, include it.**
Default to `GuestNavBar` while auth is resolving. This eliminates the flicker completely since most entity page visitors from shared links are guests anyway. The logic:
- `isLoading` (auth) or no `user` → `GuestNavBar`
- `user` exists → `NavBarComponent`

### Codex's layout-shift point — **Already handled.**
We already aligned `GuestNavBar` spacing to `py-4` matching the logged-in navbar in the previous change. No extra work needed.

### Nothing else to add.
The plan is tight as-is. One file, ~5 lines changed.

## Change

### `src/components/entity/EntityV4LoadingWrapper.tsx`
- Import `useAuth` and `GuestNavBar`
- Render `GuestNavBar` when `isLoading || !user`
- Render `NavBarComponent` only when authenticated user confirmed

```
if (isLoading || !user) → <GuestNavBar />
else → <NavBarComponent />
```

No other files change.

