import React from 'react';
import { Clock, X } from 'lucide-react';

interface RecentSearchesPanelProps {
  recents: { query: string; timestamp: number }[];
  onPick: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
  className?: string;
}

/**
 * Reusable recent-searches panel with × per row and "Clear all".
 * Renders nothing when there are no recents.
 */
export function RecentSearchesPanel({
  recents,
  onPick,
  onRemove,
  onClearAll,
  className = '',
}: RecentSearchesPanelProps) {
  if (!recents || recents.length === 0) return null;

  return (
    <div className={`bg-background ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <h4 className="text-xs font-medium text-muted-foreground">Recent searches</h4>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      </div>
      <ul>
        {recents.map((it) => (
          <li
            key={it.query}
            className="group flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors"
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <button
              type="button"
              onClick={() => onPick(it.query)}
              className="flex-1 min-w-0 text-left text-sm truncate"
            >
              {it.query}
            </button>
            <button
              type="button"
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
        ))}
      </ul>
    </div>
  );
}
