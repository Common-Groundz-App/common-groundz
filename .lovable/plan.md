

# Final Offline Snackbar Plan — Ready to Implement

No changes from the previous plan except adding `cache: 'no-store'` to the probe and using `GET` instead of `HEAD`. Everything else stays as agreed.

## Files to change

### 1. `src/services/networkStatusService.ts` — Add `probeConnectivity()`

```typescript
async probeConnectivity(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/`, {
      signal: controller.signal,
      method: 'GET',
      cache: 'no-store',
    });
    return true; // Any HTTP response = online
  } catch {
    return false; // Only transport failures = offline
  } finally {
    clearTimeout(timeout);
  }
}
```

### 2. `src/components/OfflineBanner.tsx` — Full rewrite

- **Mobile (< xl)**: Fixed bottom pill above bottom nav, `z-[41]`, `rounded-full`, `max-w-sm`, slide-up animation
- **Desktop (xl+)**: Fixed top bar, height-collapse animation
- **Retry**: probe → `reportSuccess()` → `refetchQueries({ type: 'active' })`, 5s cooldown with spinner, "Still offline" flash on failure, concurrent tap guard

### 3. ~6 feed/notification files — Shorten inline copy

- "Showing cached posts" (feeds)
- "Showing recent notifications" (notifications)

