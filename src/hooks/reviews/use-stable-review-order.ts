import { useMemo, useRef } from 'react';
import { applyStableOrder } from '@/utils/reviewDataUtils';

/**
 * Keeps card positions stable while voting. The order is recomputed from
 * `sorted` whenever `resetKey` changes (sort, filters, search, entity/profile)
 * or on remount (fresh navigation); otherwise only membership changes apply.
 */
export const useStableReviewOrder = <T extends { id: string }>(sorted: T[], resetKey: string, enabled = true): T[] => {
  const ref = useRef<{ key: string; ids: string[] } | null>(null);
  return useMemo(() => {
    if (!enabled) { ref.current = null; return sorted; }
    const prev = ref.current && ref.current.key === resetKey ? ref.current.ids : null;
    const ordered = applyStableOrder(sorted, prev);
    ref.current = { key: resetKey, ids: ordered.map(r => r.id) };
    return ordered;
  }, [sorted, resetKey, enabled]);
};
