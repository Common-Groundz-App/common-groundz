import { useCallback, useEffect, useState } from 'react';
import { normalize } from '@/utils/searchRanking';

/**
 * Surface-scoped recent-searches hook.
 * Each surface (e.g. "explore", "composer") gets its own bucket
 * in localStorage. Silently no-ops in private mode / quota errors.
 *
 * Items can be 'query' (free-text user typed) or 'entity' (user picked
 * a specific entity from results). Entity items carry slug/id/type so
 * subsequent picks can deep-link directly to the entity page.
 */

export type RecentSearchKind = 'query' | 'entity';

export interface RecentSearchItem {
  query: string;            // Display text (entity name OR user's typed query)
  timestamp: number;
  kind?: RecentSearchKind;  // Optional for back-compat with legacy stored items
  entityId?: string;
  entityType?: string;
  slug?: string;
  image_url?: string;
}

const STORAGE_PREFIX = 'cg_recent_searches_v1__';
const MAX_ENTRIES = 8;                          // storage cap
const TTL_MS = 30 * 24 * 60 * 60 * 1000;        // 30 days

function isFresh(item: RecentSearchItem): boolean {
  return Date.now() - item.timestamp < TTL_MS;
}

function readSafe(key: string): RecentSearchItem[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (it): it is RecentSearchItem =>
        it && typeof it.query === 'string' && typeof it.timestamp === 'number',
    );
    // TTL cleanup on every read
    return valid.filter(isFresh);
  } catch {
    return [];
  }
}

function writeSafe(key: string, items: RecentSearchItem[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Quota / private mode — silent no-op.
  }
}

// Stable dedup key: entity items keyed by entity id, query items by normalized text.
function dedupKey(item: RecentSearchItem): string {
  if (item.kind === 'entity' && item.entityId) {
    return `e:${item.entityId}`;
  }
  return `q:${normalize(item.query)}`;
}

export function useRecentSearches(surface: string) {
  const key = `${STORAGE_PREFIX}${surface}`;
  const [recents, setRecents] = useState<RecentSearchItem[]>(() => {
    const fresh = readSafe(key);
    // Persist the cleaned list back so stale entries don't linger across reloads.
    writeSafe(key, fresh);
    return fresh;
  });

  // Cross-tab sync (best-effort)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setRecents(readSafe(key));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  /**
   * Back-compat overloads:
   *   addRecent("ramen")                                       → kind: 'query'
   *   addRecent("Mallika Biryani", 'entity', { entityId, ... }) → kind: 'entity'
   */
  const addRecent = useCallback(
    (
      query: string,
      kind: RecentSearchKind = 'query',
      meta?: { entityId?: string; entityType?: string; slug?: string; image_url?: string },
    ) => {
      const trimmed = (query || '').trim();
      if (!trimmed) return;

      const newItem: RecentSearchItem = {
        query: trimmed,
        timestamp: Date.now(),
        kind,
        ...(kind === 'entity'
          ? {
              entityId: meta?.entityId,
              entityType: meta?.entityType,
              slug: meta?.slug,
              image_url: meta?.image_url,
            }
          : {}),
      };

      setRecents((prev) => {
        const newKey = dedupKey(newItem);
        const normalizedText = normalize(trimmed);

        // Cross-kind dedup: when adding an entity, also drop any query item with the same
        // normalized text (entity wins). When adding a query, drop matching query duplicates;
        // do NOT remove entity items just because they share the name.
        const filtered = prev.filter((it) => {
          if (dedupKey(it) === newKey) return false;
          if (
            newItem.kind === 'entity' &&
            (!it.kind || it.kind === 'query') &&
            normalize(it.query) === normalizedText
          ) {
            return false;
          }
          return true;
        });

        const next = [newItem, ...filtered].slice(0, MAX_ENTRIES);
        writeSafe(key, next);
        return next;
      });
    },
    [key],
  );

  const removeRecent = useCallback(
    (query: string) => {
      const target = normalize(query);
      setRecents((prev) => {
        const next = prev.filter((it) => normalize(it.query) !== target);
        writeSafe(key, next);
        return next;
      });
    },
    [key],
  );

  /**
   * Surgical removal by entity id — used when an entity-recent points to a deleted entity.
   * Will NOT remove query-kind items that happen to share the same text.
   */
  const removeRecentByEntityId = useCallback(
    (entityId: string) => {
      if (!entityId) return;
      setRecents((prev) => {
        const next = prev.filter(
          (it) => !(it.kind === 'entity' && it.entityId === entityId),
        );
        writeSafe(key, next);
        return next;
      });
    },
    [key],
  );

  const clearRecents = useCallback(() => {
    setRecents([]);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // silent
    }
  }, [key]);

  return { recents, addRecent, removeRecent, removeRecentByEntityId, clearRecents };
}
