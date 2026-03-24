

# Fix "Who to Follow" Skeleton Flash — IMPLEMENTED ✅

## Changes applied to `src/pages/Feed.tsx`

### 1. Moved all hooks above early returns ✅
All `useState`, `useIsMobile`, `useLocation`, `useNotifications`, `useRef` declarations moved before the `if (isLoading)` and `if (!user)` early returns.

### 2. Rewrote recommendations `useEffect` ✅
- `[user?.id]` dependency — stable string, no spurious refetches
- TTL guard (5 min) via `lastFetchedAtRef` — skips fetch if data is fresh
- Conditional skeleton — only when `recommendedUsers.length === 0`
- No `mutualDataMap` clearing before fetch — prevents proof-line flicker
- Race condition guard — `let cancelled = false` with cleanup
- Reset on logout — clears state and timestamp when `!user?.id`
- `cancelled` check before every state update
