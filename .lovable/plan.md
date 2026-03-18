

# Inline Offline State Improvements — Final Plan

## Codex feedback: Agree on both points

**Contextual no-cache copy — Yes, adopt.** "Can't load posts while offline" is better than generic "You're offline" since the global snackbar already communicates network state. The inline banner should explain the *consequence* for that surface.

**`lastRefresh` — Skip for feeds for now.** Feed hooks (`use-feed.ts`, `use-infinite-feed.ts`) don't track a `lastRefresh` timestamp. Adding one properly means modifying both hooks. Not worth it for this pass — notifications and explore already have it. We can add it to feeds later.

Nothing else to add. The plan is solid.

## Changes

### Feed surfaces (4 files)
**`FeedForYou.tsx`, `EnhancedFeedForYou.tsx`, `InfiniteFeedForYou.tsx`, `FeedFollowing.tsx`**

- When `items.length > 0` + offline: remove `onRetry` prop (informational only)
- When `items.length === 0` + offline: use contextual copy, keep `onRetry`:
  - Feed surfaces: `"Can't load posts while offline"`

### Notification surfaces (2 files)
**`NotificationPopover.tsx`, `NotificationDrawer.tsx`**

- When `notifications.length > 0` + offline: remove `onRetry` prop from inline banner
- When `notifications.length === 0` + offline: change message to `"Can't load notifications while offline"`, keep `onRetry`
- `lastRefresh` already passed — no change needed

### `OfflineInlineState.tsx` — No changes needed
Already handles conditional Retry rendering based on `onRetry` prop presence.

