

# Fix "Who to Follow" Skeleton Flash — Final Plan

ChatGPT's interval suggestion contradicts your own project architecture policy: **no `setInterval`** — your codebase uses self-rescheduling `setTimeout` guarded by `document.hidden`. But more importantly, this is unnecessary complexity. The trending hashtags card never auto-refreshes and works perfectly. Recommendations will refresh on navigation or page reload, which is sufficient.

**The plan is ready. No more additions needed.**

---

## Changes — `src/pages/Feed.tsx`

### 1. Move all hooks above early returns

Move all hook declarations (around lines 84-110: `useIsMobile`, `useLocation`, `useState(activeTab)`, `useNotifications`, pull-to-refresh state, etc.) to **before** the `if (isLoading)` early return at line 58. Early returns stay, just after all hooks.

### 2. Rewrite recommendations `useEffect`

Replace the current recommendations fetch effect with:

- **`[user?.id]`** dependency — stable string, no spurious refetches
- **TTL guard** — `useRef<number>(0)` tracks last fetch time; skip if data exists and < 5 min old
- **Conditional skeleton** — only `setUsersLoading(true)` when `recommendedUsers.length === 0`
- **Don't clear `mutualDataMap`** before fetch — keeps proof-line visible during background refresh
- **Race condition guard** — `let cancelled = false` with cleanup return
- **Reset on logout** — clear state and timestamp when `!user?.id`
- **`cancelled` check** before every state update (`setRecommendedUsers`, `setMutualDataMap`, `setUsersLoading`)

### What we're NOT adding

- No `setInterval` for auto-refresh (violates project timer policy; unnecessary)
- No React Query migration (local state works fine, proven by trending hashtags)
- No sidebar memoization (optimization for later)

