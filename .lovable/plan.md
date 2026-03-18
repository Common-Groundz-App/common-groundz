
# Global Offline/Network Handling System — COMPLETE ✅

Initiative closed after Phase 1, Phase 2, and final QA sweep.

## Phase 1 — Network layer & silent background failures

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

## Phase 2 — Inline offline states, timer migrations, notification surfaces

### New files
- `src/components/ui/OfflineInlineState.tsx` — Compact inline offline banner for individual surfaces
- `src/components/ui/LastUpdatedIndicator.tsx` — Shared tick singleton for relative timestamps

### Inline offline state integrated into
- `src/components/feed/FeedForYou.tsx`
- `src/components/feed/EnhancedFeedForYou.tsx`
- `src/components/feed/InfiniteFeedForYou.tsx`
- `src/components/feed/FeedFollowing.tsx`
- `src/components/notifications/NotificationDrawer.tsx`
- `src/components/notifications/NotificationPopover.tsx`
- `src/components/notifications/NotificationContent.tsx`

### Timer migrations (`setInterval` → guarded `setTimeout`)
- `src/hooks/use-discovery.ts`
- `src/hooks/use-enhanced-explore.ts`
- `src/hooks/admin/useAdminSuggestions.ts`
- `src/hooks/admin/use-cache-analytics.ts`
- `src/hooks/useMemoryOptimization.ts`

## Final QA Sweep

### Removed remaining background-fetch toasts
- `src/components/content/RecommendationContentViewer.tsx` — Removed destructive toast on fetch failure (fallback UI already handles it)
- `src/hooks/feed/use-feed.ts` — Removed `useEffect` that toasted on `feedError` (background refetch noise)

### Confirmed clean (no action needed)
- `PostContentViewer.tsx`, `use-search.ts`, `EntityRecommendationModal.tsx`, `ReviewTimelineViewer.tsx`, `ChatInterface.tsx`, `AdminPhotoModerationPanel.tsx`

## Rules (documented in App.tsx)
1. Background queries fail silently — no destructive toasts
2. User mutations can show error toasts
3. Never clear UI data on fetch failure
4. All polling respects shared network state via `useNetworkStatus()`
5. `navigator.onLine` only checked inside networkStatusService
6. Only transport failures count toward offline detection
