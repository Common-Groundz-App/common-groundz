import React, { useEffect, useRef } from 'react';
import { History, X } from 'lucide-react';
import type { RecentSearchItem } from '@/hooks/useRecentSearches';
import { useEntityCache } from '@/hooks/use-entity-cache';

interface RecentSearchesPanelProps {
  recents: RecentSearchItem[];
  /**
   * Back-compat: existing callers pass `(query: string) => void`.
   * New callers can opt into the full item via the second arg.
   */
  onPick: (query: string, item?: RecentSearchItem) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
  className?: string;
  /** Visible cap. Storage cap (8) lives in the hook. */
  maxVisible?: number;
  /** Optional: when provided, used by parent for keyboard-driven aria-activedescendant wiring. */
  optionIdPrefix?: string;
  /** Optional: index of the keyboard-highlighted item (parent-controlled). */
  highlightedIndex?: number;
}

/**
 * Reusable recent-searches panel with × per row and "Clear all".
 * Renders nothing when there are no recents.
 *
 * Entity-kind items get a bookmark icon and trigger a debounced prefetch on hover
 * so navigation feels instant. Query-kind (and legacy items without a kind) get
 * the original clock icon and refill the search input on click.
 */
export function RecentSearchesPanel({
  recents,
  onPick,
  onRemove,
  onClearAll,
  className = '',
  maxVisible = 6,
  optionIdPrefix = 'recent-opt',
  highlightedIndex,
}: RecentSearchesPanelProps) {
  // Debounced prefetch wiring (80ms idle, only when slug changes).
  const { prefetchEntity } = useEntityCache({ slugOrId: '', enabled: false });
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPrefetchedSlugRef = useRef<string | null>(null);

  const schedulePrefetch = (slug?: string) => {
    if (!slug || slug === lastPrefetchedSlugRef.current) return;
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = setTimeout(() => {
      prefetchEntity(slug);
      lastPrefetchedSlugRef.current = slug;
    }, 80);
  };

  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    };
  }, []);

  if (!recents || recents.length === 0) return null;

  const visible = recents.slice(0, maxVisible);

  return (
    <div className={`bg-background ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <h4 className="text-xs font-medium text-muted-foreground">Recent searches</h4>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Clear all
        </button>
      </div>
      <ul role="listbox" aria-label="Recent searches">
        {visible.map((it, idx) => {
          const isEntity = it.kind === 'entity' && !!it.slug;
          const isHighlighted = highlightedIndex === idx;
          const optionId = `${optionIdPrefix}-${idx}`;
          return (
            <li
              key={`${it.kind ?? 'query'}:${it.entityId ?? it.query}:${it.timestamp}`}
              id={optionId}
              role="option"
              aria-selected={isHighlighted}
              onMouseEnter={() => isEntity && schedulePrefetch(it.slug)}
              className={`group flex items-center gap-2 px-3 py-2 transition-colors ${
                isHighlighted ? 'bg-accent/40' : 'hover:bg-accent/30'
              }`}
            >
              <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault() /* keep input focus */}
                onClick={() => onPick(it.query, it)}
                className="flex-1 min-w-0 text-left text-sm truncate"
              >
                {it.query}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(it.query);
                }}
                aria-label={`Remove ${it.query} from recent searches`}
                className="p-1 rounded-full hover:bg-muted opacity-60 hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
