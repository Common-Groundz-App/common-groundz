
# Global Offline/Network Handling System — IMPLEMENTED

## What was built

### New files
- `src/services/networkStatusService.ts` — Singleton managing network state with transport-only failure counting, pub/sub, browser event listeners
- `src/hooks/useNetworkStatus.ts` — React hook via `useSyncExternalStore` consuming the singleton
- `src/components/OfflineBanner.tsx` — Animated offline/reconnected banner (framer-motion)

### Modified files
- `src/App.tsx` — React Query `onlineManager` wired to singleton, global defaults (`retry: 2`, `staleTime: 30s`, `refetchOnReconnect: true`), `OfflineBanner` mounted, error policy documented
- `src/hooks/useNotifications.ts` — `setInterval` → self-rescheduling `setTimeout`, polling guarded by shared network state, background toast removed
- `src/hooks/recommendations/use-recommendations-fetch.ts` — Background toast removed
- `src/components/feed/FeedForYou.tsx` — Background toast removed
- `src/components/feed/EnhancedFeedForYou.tsx` — Background toast removed
- `src/components/feed/FeedFollowing.tsx` — Background toast removed
- `src/components/entity/EntityFollowerModal.tsx` — Background toast removed
- `src/components/content/PostContentViewer.tsx` — Background toast removed
- `src/hooks/admin/useAdminSuggestions.ts` — Initial fetch toast silenced

### Rules (documented in App.tsx)
1. Background queries fail silently — no destructive toasts
2. User mutations can show error toasts
3. Never clear UI data on fetch failure
4. All polling respects shared network state via `useNetworkStatus()`
5. `navigator.onLine` only checked inside networkStatusService
6. Only transport failures count toward offline detection

## Phase 2 (later)
- Inline offline states per surface
- Migrate `setInterval` hooks to React Query `refetchInterval`
- "Last updated" indicators
