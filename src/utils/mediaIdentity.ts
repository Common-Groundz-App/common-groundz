import type { MediaItem } from '@/types/media';
import { matchesMediaIdentity, mediaIdentity } from '@/utils/composerVideoReadiness';

/**
 * Phase 4 Step 3 — stable media identity for Post media display.
 *
 * A media item's stable identity is its persisted `id` (uuid, server-owned
 * since Phase 4 Step 2). Position in the array is NEVER identity: it is
 * derived from the ID at the moment of use only.
 *
 * Grandfathered historical items may have no `id`. They have no stable
 * identity: `mediaKey` returns null (never ''), and callers keep the
 * legacy positional behavior for exactly those items.
 */

/** The item's stable media ID, or null when it genuinely has none. Never ''. */
export function mediaKey(item: MediaItem | null | undefined): string | null {
  const id = item?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Resolve the current index of the item with the given media key.
 * Returns -1 when the key is null or no item matches — callers must treat
 * -1 as "gone", never as "fall back to the old position".
 */
/**
 * Ensures a composer-local render identity exists on an item. Generated once
 * when an item enters composer state and never regenerated; strictly UI-only
 * (never persisted — the save payload lists its fields explicitly).
 */
export function ensureClientKey<T extends MediaItem>(item: T): T {
  if (item.clientKey) return item;
  return { ...item, clientKey: crypto.randomUUID() };
}

/**
 * Adopts authoritative server media state into composer items after
 * save/readback. Matches by current media identity (id → mux_upload_id →
 * url), updates ONLY the persisted `id` (and keeps every other local field,
 * including `clientKey`), so adopting a changed server ID can never remount
 * the tile, revoke the local blob preview, reset playback, or reorder media.
 * Items with no server match are kept unchanged.
 */
export function reconcileComposerMedia(
  current: readonly MediaItem[],
  persisted: readonly MediaItem[] | null | undefined
): MediaItem[] {
  if (!persisted || persisted.length === 0) return [...current];
  return current.map((item) => {
    const match = persisted.find((p) => matchesMediaIdentity(p, mediaIdentity(item)));
    if (match && match.id && match.id !== item.id) {
      return { ...item, id: match.id };
    }
    return item;
  });
}

export function findByMediaKey(media: readonly MediaItem[], key: string | null | undefined): number {
  if (!key) return -1;
  return media.findIndex((item) => item.id === key);
}
