

# Fix `cachedPhotoService.ts` — Last Leaked Interval

## What
Replace the bare `setInterval` in `startPeriodicCleanup()` (line 52) with the same guarded `setTimeout` chain used in the other 5 services.

## Changes (1 file)

### `src/services/cachedPhotoService.ts`

1. Add properties: `private cleanupTimer?: number` and `private cleanupStarted = false`
2. Replace `startPeriodicCleanup()` with `scheduleCleanup()` using the standard pattern:
   - **SSR guard**: `if (typeof window === 'undefined') return`
   - **Duplicate guard**: `if (this.cleanupStarted) return`
   - **State guard inside callback**: `if (!this.cleanupStarted) return`
   - **Visibility guard**: `if (!document.hidden)` before doing work
   - Self-rescheduling `setTimeout`
3. Update `getInstance()` to call `scheduleCleanup()` instead of `startPeriodicCleanup()`

No other files changed.

