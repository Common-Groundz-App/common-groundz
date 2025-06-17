
import React from 'react';
import { ChevronRight, Sparkles, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from './ProductCard';
import type { EntityCollection } from '@/services/exploreService';

interface CollectionSectionProps {
  collection: EntityCollection;
  onEntityView: (entityId: string, entityType: string) => void;
  onViewAll?: (collectionId: string) => void;
}

export const CollectionSection: React.FC<CollectionSectionProps> = ({
  collection,
  onEntityView,
  onViewAll
}) => {
  if (!collection.entities?.length) return null;

  const getCollectionIcon = (type: string) => {
    switch (type) {
      case 'themed': return <Sparkles className="w-5 h-5 text-purple-500" />;
      case 'trending': return <Clock className="w-5 h-5 text-orange-500" />;
      case 'location': return <MapPin className="w-5 h-5 text-green-500" />;
      default: return <Sparkles className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getCollectionIcon(collection.type)}
          <div>
            <h2 className="text-2xl font-bold">{collection.name}</h2>
            {collection.description && (
              <p className="text-muted-foreground text-sm">{collection.description}</p>
            )}
          </div>
        </div>
        
        {collection.entities.length > 6 && onViewAll && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onViewAll(collection.id)}
            className="flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {collection.entities.slice(0, 6).map((entity) => (
          <ProductCard
            key={entity.id}
            entity={entity}
            onClick={() => onEntityView(entity.id, entity.type)}
            compact
          />
        ))}
      </div>
    </div>
  );
};
