
import React from 'react';
import { Link } from 'react-router-dom';
import { EntitySearchResult } from '@/hooks/use-unified-search';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getEntityUrl } from '@/utils/entityUrlUtils';

interface EntityResultItemProps {
  entity: EntitySearchResult;
  onClick: () => void;
}

export function EntityResultItem({ entity, onClick }: EntityResultItemProps) {
  // Always use the standardized entity URL format
  const getEntityPath = () => {
    return getEntityUrl(entity);
  };

  return (
    <Link
      to={getEntityPath()}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors rounded-lg"
      onClick={onClick}
    >
      <Avatar className="h-12 w-12">
        <AvatarImage src={entity.image_url || undefined} alt={entity.name} />
        <AvatarFallback className="bg-primary/10 text-primary">
          {entity.name[0]?.toUpperCase() || 'E'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium truncate">{entity.name}</p>
          <Badge variant="outline" className="text-xs py-0 px-1.5 h-5 bg-muted/50">
            {entity.type}
          </Badge>
        </div>
        {entity.venue && (
          <div className="flex items-center text-xs text-muted-foreground mb-1">
            <MapPin className="w-3 h-3 mr-1" /> 
            <span className="truncate">{entity.venue}</span>
          </div>
        )}
        {entity.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {entity.description}
          </p>
        )}
      </div>
    </Link>
  );
}
