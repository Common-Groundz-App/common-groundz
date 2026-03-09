

# Fix `cachedPhotoService.ts` — Implementation

The file was never modified. It still contains the leaked `setInterval` at line 52. Here is exactly what needs to change:

## Single file: `src/services/cachedPhotoService.ts`

### 1. Add two new properties (after line 38)
```typescript
private cleanupTimer?: number;
private cleanupStarted = false;
```

### 2. Replace `getInstance()` (lines 40-46)
Change `startPeriodicCleanup()` call to `scheduleCleanup()`:
```typescript
static getInstance(): CachedPhotoService {
  if (!CachedPhotoService.instance) {
    CachedPhotoService.instance = new CachedPhotoService();
    CachedPhotoService.instance.scheduleCleanup();
  }
  return CachedPhotoService.instance;
}
```

### 3. Replace `startPeriodicCleanup()` (lines 48-67) with:
```typescript
private scheduleCleanup(): void {
  if (typeof window === 'undefined' || this.cleanupStarted) return;
  this.cleanupStarted = true;

  const run = () => {
    if (!this.cleanupStarted) return;

    if (!document.hidden) {
      const now = Date.now();
      let cleanedCount = 0;
      for (const [key, value] of this.inMemoryCache.entries()) {
        if (now - value.timestamp > this.IN_MEMORY_TTL) {
          this.inMemoryCache.delete(key);
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        console.log(`🧹 [PhotoCache] Cleaned ${cleanedCount} expired in-memory cache entries`);
      }
    }

    this.cleanupTimer = window.setTimeout(run, 60 * 1000);
  };

  this.cleanupTimer = window.setTimeout(run, 60 * 1000);
}
```

No other files changed. This completes the leaked interval fix across all 6 services.

