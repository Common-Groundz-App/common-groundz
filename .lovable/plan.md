

# Fix Leaked Intervals — Final Plan

Both suggestions are valid and minor to incorporate. Here's the final version.

## Timer Pattern (applied to all 6 files)

```text
private timer?: number;
private isRunning = false;

private scheduleX() {
  if (!this.isRunning || this.timer) return;   // state + duplicate guard

  this.timer = window.setTimeout(() => {
    this.timer = undefined;
    if (!this.isRunning) return;                // post-stop guard
    if (!document.hidden) this.doWork();        // visibility guard
    this.scheduleX();                           // reschedule
  }, interval);
}

stop() {
  this.isRunning = false;
  if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
}
```

All module-level code guarded with `if (typeof window !== 'undefined')` where not already present.

## Files (6)

### 1. `src/services/performanceAnalyticsService.ts`
- Add `flushTimer`, `memoryTimer` properties
- Replace both `setInterval` with `scheduleFlush()` / `scheduleMemoryCheck()` using pattern above
- `stopMonitoring()` clears both and sets `isMonitoring = false`
- Callback checks `this.isMonitoring` before rescheduling

### 2. `src/services/cacheService.ts`
- Remove module-level `setInterval`
- Add `cleanupTimer` + `cleanupStarted` flag on `CacheService`
- Lazy-start on first `set()` call

### 3. `src/services/browserPhotoCache.ts`
- Remove module-level `setInterval`
- Add `cleanupTimer` + `cleanupStarted` flag
- Lazy-start on first `set()` call

### 4. `src/services/imagePerformanceService.ts`
- Remove module-level `setInterval` block entirely

### 5. `src/services/enhancedUnifiedProfileService.ts`
- Remove module-level `setInterval`
- Add lazy `setTimeout` chain on `ProfileCache`, started from first cache write

### 6. `src/services/advancedCacheManager.ts`
- Replace `setInterval` in `startBackgroundMaintenance()` with `setTimeout` chain
- Add `maintenanceTimer` + state guard

## Not changed
- React hooks with `useEffect` cleanup — already correct
- `CacheProvider.tsx` — already cleans up
- `backgroundService.ts` — production-only, has proper stop method

