/**
 * Phase 2 — Feed video resume LRU store.
 *
 * Session-only, in-memory map of `stableSlotId -> { time, updatedAt }`.
 * Bounded at FEED_VIDEO_RESUME_MAX entries. Both write and read promote
 * recency (delete-then-set) so frequently revisited videos stay warm
 * even when 128+ other videos are seen between visits.
 *
 * No localStorage, no DB, no persistence across reloads. SSR-safe.
 */

export const FEED_VIDEO_RESUME_MAX = 128;
export const FEED_VIDEO_RESUME_MIN = 1.5;
export const FEED_VIDEO_RESUME_TAIL = 1.0;

interface ResumeEntry {
  time: number;
  updatedAt: number;
}

const store: Map<string, ResumeEntry> = new Map();

export function saveFeedVideoResume(
  id: string,
  time: number,
  duration?: number
): void {
  if (!id) return;
  if (!Number.isFinite(time) || time < 0) return;

  // Below MIN → ignore. Clearing is the consumer's call (Safeguard E)
  // so we don't wipe a real prior entry on transient near-zero saves
  // (e.g. HLS re-attach pause at t=0).
  if (time < FEED_VIDEO_RESUME_MIN) return;

  // Within tail of duration → treat as completed, clear and bail.
  if (
    typeof duration === 'number' &&
    Number.isFinite(duration) &&
    duration > 0 &&
    time >= duration - FEED_VIDEO_RESUME_TAIL
  ) {
    store.delete(id);
    return;
  }

  // LRU promote-on-write: delete-then-set moves entry to the most-recent
  // position in Map insertion order.
  store.delete(id);
  store.set(id, { time, updatedAt: Date.now() });

  // Evict oldest entries while over cap.
  while (store.size > FEED_VIDEO_RESUME_MAX) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

export function readFeedVideoResume(id: string): number | null {
  if (!id) return null;
  const entry = store.get(id);
  if (!entry) return null;
  // LRU promote-on-read: a video the user keeps revisiting should stay
  // warm even if many newer one-off entries arrive between visits.
  store.delete(id);
  store.set(id, entry);
  return entry.time;
}

export function clearFeedVideoResume(id: string): void {
  if (!id) return;
  store.delete(id);
}

// Test-only escape hatch. Not used in production paths.
export function __resetFeedVideoResumeStoreForTests(): void {
  store.clear();
}
