import { useCallback, useEffect, useState } from 'react';

/**
 * Surface-scoped recent-searches hook.
 * Each surface (e.g. "explore", "composer") gets its own bucket
 * in localStorage. Silently no-ops in private mode / quota errors.
 */

interface RecentSearchItem {
  query: string;
  timestamp: number;
}

const STORAGE_PREFIX = 'cg_recent_searches_v1__';
const MAX_ENTRIES = 8;

function readSafe(key: string): RecentSearchItem[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it): it is RecentSearchItem =>
        it && typeof it.query === 'string' && typeof it.timestamp === 'number',
    );
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

export function useRecentSearches(surface: string) {
  const key = `${STORAGE_PREFIX}${surface}`;
  const [recents, setRecents] = useState<RecentSearchItem[]>(() => readSafe(key));

  // Cross-tab sync (best-effort)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setRecents(readSafe(key));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const addRecent = useCallback(
    (query: string) => {
      const trimmed = (query || '').trim();
      if (!trimmed) return;
      setRecents((prev) => {
        const filtered = prev.filter(
          (it) => it.query.toLowerCase() !== trimmed.toLowerCase(),
        );
        const next = [{ query: trimmed, timestamp: Date.now() }, ...filtered].slice(
          0,
          MAX_ENTRIES,
        );
        writeSafe(key, next);
        return next;
      });
    },
    [key],
  );

  const removeRecent = useCallback(
    (query: string) => {
      setRecents((prev) => {
        const next = prev.filter(
          (it) => it.query.toLowerCase() !== query.toLowerCase(),
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

  return { recents, addRecent, removeRecent, clearRecents };
}
