

# Fix: ProfileCache Race Condition — Final Plan

Both reviewers approve. Incorporating their additions.

## Core Fix: `src/services/enhancedUnifiedProfileService.ts`

**`processBatch()` method** — snapshot batches before async work:

```text
processBatch() {
  const batchesToProcess = [...this.pendingBatches];
  this.pendingBatches.length = 0;
  this.batchTimeout = null;

  if (batchesToProcess.length === 0) return;  // ChatGPT: empty guard

  const allUserIds = new Set<string>();
  batchesToProcess.forEach(b => b.userIds.forEach(id => allUserIds.add(id)));
  const uniqueUserIds = Array.from(allUserIds);  // Already deduped via Set

  // fetch + resolve only batchesToProcess
}
```

**`setCache()` — don't cache fallback profiles** (Codex's point): Skip caching when profile has `id === ''` (the anonymous fallback). This prevents a failed batch from poisoning the cache for subsequent correct fetches.

Apply this in both `fetchProfilesBatchDirect` and `fetchSingleProfileDirect` — don't cache fallback profiles with empty IDs.

## Files

| File | Change |
|------|--------|
| `src/services/enhancedUnifiedProfileService.ts` | Snapshot batches, empty guard, skip caching anonymous fallbacks |

One file, ~15 lines changed. No migration. No component changes.

## Verification

1. Guest entity page — all review authors show real names
2. Logged-in entity page — same
3. Timeline modal — names match review cards
4. Quick navigation between entities — no stale anonymous profiles
5. Cold refresh — profiles load correctly

