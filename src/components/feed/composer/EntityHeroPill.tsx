import React from 'react';
import { Tag, X, ChevronDown, Plus } from 'lucide-react';
import type { Entity } from '@/services/recommendation/types';

interface EntityHeroPillProps {
  entities: Entity[];
  onOpenSelector: () => void;
  onRemoveEntity: (entityId: string) => void;
}

const getEntityIcon = (type: string) => {
  switch (type) {
    case 'place': return '🏠';
    case 'food': return '🍽️';
    case 'movie': return '🎬';
    case 'book': return '📚';
    case 'product': return '💄';
    default: return '🏷️';
  }
};

// Shared pill sizing so empty state, selected chips, and "Add more" share one visual family.
const PILL_BASE =
  'inline-flex items-center gap-1.5 h-8 rounded-full border text-sm font-medium transition-colors';

/**
 * Compact entity selector pill.
 * - Empty state: left-aligned, content-sized pill with solid border (Reddit-inspired shape).
 * - Selected state: chips share the pill family with a subtle primary tint.
 * - "Add more" is a matching ghost pill, not a tiny text link.
 */
export const EntityHeroPill: React.FC<EntityHeroPillProps> = ({
  entities,
  onOpenSelector,
  onRemoveEntity,
}) => {
  if (entities.length === 0) {
    return (
      <div className="flex">
        <button
          type="button"
          onClick={onOpenSelector}
          className={`${PILL_BASE} border-border bg-background text-foreground px-3.5 hover:bg-accent/40`}
        >
          <Tag className="h-3.5 w-3.5" />
          <span>Select entities</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entities.map((entity) => (
        <span
          key={entity.id}
          className={`${PILL_BASE} border-primary/20 bg-primary/5 text-foreground pl-3 pr-1`}
        >
          <span className="text-base leading-none">{getEntityIcon(entity.type)}</span>
          <span>{entity.name}</span>
          <button
            type="button"
            onClick={() => onRemoveEntity(entity.id)}
            aria-label={`Remove ${entity.name}`}
            className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onOpenSelector}
        className={`${PILL_BASE} border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/40 px-3`}
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add more</span>
      </button>
    </div>
  );
};
