

# Final Implementation Plan — Global Offline/Network Handling System

Both additions from this round are correct. Here's the complete, final plan with everything incorporated.

## Additions accepted

1. **ChatGPT's two polish items**: Reset failure count on success (already implied, now explicit). Minimum offline duration before showing "Back online" banner (prevents flicker).

2. **Codex's failure classification rule**: Only count transport-level failures (`TypeError: Failed to fetch`, `AbortError`, timeouts, `navigator.onLine === false`). Do not count 400/401/403/404/500 — those are app/server errors, not connectivity problems.

Both are small but prevent real bugs. No more refinements needed — this plan is ready to build.

---

## Architecture

```text
┌─────────────────────────────────────┐
│  networkStatusService.ts (singleton)│
│  - browser online/offline events    │
│  - transport failure counting only  │
│  - 3+ transport failures → offline  │
│  - any success → reset counter      │
│  - pub/sub for subscribers          │
│  - navigator.onLine checked HERE    │
│    only, nowhere else in app        │
└──────────────┬──────────────────────┘
               │ useSyncExternalStore
┌──────────────▼──────────────────────┐
│  useNetworkStatus() (React hook)    │
│  returns { isOnline, wasOffline }   │
└──────────────┬──────────────────────┘
               │
     ┌─────────┼────────────┐
     ▼         ▼            ▼
  Banner    Polling      React Query
            guards       onlineManager
```

## New files

### `src/services/networkStatusService.ts`
Module-level singleton. One shared state: `{ isOnline, wasOffline, failureCount }`. Browser event listeners attached once. `reportFailure(error)` classifies: only `TypeError` (fetch failed), `AbortError`, explicit timeouts increment counter. HTTP status errors (4xx/5xx) are ignored. `reportSuccess()` resets counter to 0. 3+ transport failures → `isOnline = false`. Pub/sub notify on change. Uses `setTimeout` pattern per background-timer-policy (no `setInterval`).

### `src/hooks/useNetworkStatus.ts`
Thin React wrapper. `useSyncExternalStore` subscribing to the singleton. Returns `{ isOnline, wasOffline }`. No local state, no local event listeners.

### `src/components/OfflineBanner.tsx`
Uses `useNetworkStatus()`. Offline → dark banner "You're offline". Back online → green banner "Back online" only if offline lasted 2+ seconds (prevents flicker on unstable connections), auto-dismiss after 3s. Animated with framer-motion.

## Modified files

### `src/App.tsx`
- `onlineManager.setEventListener` wired to singleton
- QueryClient defaults: `retry: 2`, `refetchOnReconnect: true`, `staleTime: 30_000`, `refetchOnWindowFocus: false`
- Error policy comment documenting the 5 rules
- Mount `<OfflineBanner />` inside Router above Routes

### `src/hooks/useNotifications.ts`
- Replace `setInterval` with self-rescheduling `setTimeout`
- Guard polling with `useNetworkStatus().isOnline`
- Remove destructive toast from `fetchAll` catch
- Keep toast in `markAsRead` catch

### Toast audit — silence background fetch toasts

| File | Change |
|------|--------|
| `use-recommendations-fetch.ts` | Remove error toast from useEffect |
| `FeedForYou.tsx` | Remove "Failed to load feed" toast |
| `EnhancedFeedForYou.tsx` | Remove "Failed to load feed" toast |
| `FeedFollowing.tsx` | Remove "Failed to load feed" toast |
| `EntityFollowerModal.tsx` | Remove "Failed to load followers" toast |
| `PostContentViewer.tsx` | Remove "Failed to load" toast |
| `useAdminSuggestions.ts` | Guard auto-refresh toast |
| `use-discovery.ts` | Guard polling with network status |
| `use-enhanced-explore.ts` | Guard polling with network status |

Keep all user-action toasts (mutations, auth, uploads) unchanged.

## Rules (code comments in App.tsx)

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

This plan is final and ready to implement.

