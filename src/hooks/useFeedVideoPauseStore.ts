/**
 * Phase 3 — Feed video manual-pause intent LRU store.
 *
 * Session-only, in-memory map of `stableSlotId -> true` for slots where
 * the user manually paused. Bounded at FEED_VIDEO_PAUSE_MAX entries.
 * Only `true` is stored — clearing intent deletes the entry. Both write
 * and read promote recency (delete-then-set) so frequently revisited
 * paused videos stay warm.
 *
 * No localStorage, no DB, no persistence across reloads. SSR-safe.
 *
 * Parallel to useFeedVideoResumeStore.ts: pause intent and resume time
 * are independent concerns and must not share keys' lifecycles.
 */

export const FEED_VIDEO_PAUSE_MAX = 128;

const store: Map<string, true> = new Map();

export function writeFeedVideoUserPaused(id: string, paused: boolean): void {
  if (!id) return;
  if (!paused) {
    store.delete(id);
    return;
  }
  // LRU promote-on-write.
  store.delete(id);
  store.set(id, true);
  while (store.size > FEED_VIDEO_PAUSE_MAX) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

export function readFeedVideoUserPaused(id: string): boolean {
  if (!id) return false;
  if (!store.has(id)) return false;
  // LRU promote-on-read.
  store.delete(id);
  store.set(id, true);
  return true;
}

export function clearFeedVideoUserPaused(id: string): void {
  if (!id) return;
  store.delete(id);
}

// Test-only escape hatch.
export function __resetFeedVideoPauseStoreForTests(): void {
  store.clear();
}
