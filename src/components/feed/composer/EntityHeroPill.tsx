import React from 'react';
import { Tag, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

/**
 * Hero pill that promotes entity tagging to the top of the composer.
 * - Empty state: prominent dashed pill encouraging selection
 * - Selected state: chips inline with "+ Add more" affordance
 */
export const EntityHeroPill: React.FC<EntityHeroPillProps> = ({
  entities,
  onOpenSelector,
  onRemoveEntity,
}) => {
  if (entities.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpenSelector}
        className="group flex w-full items-center gap-2 rounded-full border border-dashed border-border bg-accent/20 hover:bg-accent/40 hover:border-foreground/30 px-4 py-2.5 text-sm text-muted-foreground transition-colors"
      >
        <Tag className="h-4 w-4" />
        <span className="flex-1 text-left">Tag entities (optional but recommended)</span>
        <ChevronDown className="h-4 w-4 opacity-60 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entities.map((entity) => (
        <Badge
          key={entity.id}
          variant="outline"
          className="gap-1 pl-2 pr-1 py-1 flex items-center text-xs bg-accent/30"
        >
          <span>{getEntityIcon(entity.type)}</span>
          <span>{entity.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 rounded-full hover:bg-muted"
            onClick={() => onRemoveEntity(entity.id)}
            aria-label={`Remove ${entity.name}`}
          >
            <X size={10} />
          </Button>
        </Badge>
      ))}
      <button
        type="button"
        onClick={onOpenSelector}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full hover:bg-accent/30"
      >
        + Add more
      </button>
    </div>
  );
};
