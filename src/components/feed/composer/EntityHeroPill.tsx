import React from 'react';
import { Tag, X, ChevronDown, Plus } from 'lucide-react';
import type { Entity } from '@/services/recommendation/types';
import { getOptimalEntityImageUrl, getEntityTypeFallbackImage } from '@/utils/entityImageUtils';

interface EntityHeroPillProps {
  entities: Entity[];
  onOpenSelector: () => void;
  onRemoveEntity: (entityId: string) => void;
}

const getEntityEmoji = (type: string) => {
  switch (type) {
    case 'place': return '🏠';
    case 'food': return '🍽️';
    case 'movie': return '🎬';
    case 'book': return '📚';
    case 'product': return '💄';
    default: return '🏷️';
  }
};

const TYPE_BG: Record<string, string> = {
  place: 'bg-emerald-100 dark:bg-emerald-900/40',
  food: 'bg-orange-100 dark:bg-orange-900/40',
  movie: 'bg-violet-100 dark:bg-violet-900/40',
  book: 'bg-blue-100 dark:bg-blue-900/40',
  product: 'bg-pink-100 dark:bg-pink-900/40',
};

// Shared pill sizing so empty state, selected chips, and "Add more" share one visual family.
const PILL_BASE =
  'inline-flex items-center gap-1.5 h-10 rounded-full border text-sm transition-colors';

/**
 * Reddit-inspired entity pill with circular entity image and bold name.
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
          className={`${PILL_BASE} font-medium border-border bg-background text-foreground px-3.5 hover:bg-accent/40`}
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
      {entities.map((entity) => {
        const imageUrl = getOptimalEntityImageUrl(entity as any);
        return (
          <span
            key={entity.id}
            className={`${PILL_BASE} border-primary/20 bg-primary/5 text-foreground pl-1.5 pr-1.5`}
          >
            {/* Circular entity image – Reddit-style avatar */}
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="h-7 w-7 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <span
                className={`inline-flex items-center justify-center h-7 w-7 rounded-full flex-shrink-0 text-xs ${TYPE_BG[entity.type] || 'bg-muted'}`}
              >
                {getEntityEmoji(entity.type)}
              </span>
            )}
            <span className="font-semibold text-base truncate max-w-[180px]">{entity.name}</span>
            <button
              type="button"
              onClick={() => onRemoveEntity(entity.id)}
              aria-label={`Remove ${entity.name}`}
              className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={onOpenSelector}
        className={`${PILL_BASE} font-medium border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/40 px-3`}
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add more</span>
      </button>
    </div>
  );
};
