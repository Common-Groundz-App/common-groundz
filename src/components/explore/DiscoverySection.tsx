
import React from 'react';
import { Gem, Sparkles, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from './ProductCard';

interface DiscoverySectionProps {
  hiddenGems: any[];
  newEntities: any[];
  onEntityView: (entityId: string, entityType: string) => void;
}

export const DiscoverySection: React.FC<DiscoverySectionProps> = ({
  hiddenGems,
  newEntities,
  onEntityView
}) => {
  const hasContent = hiddenGems.length > 0 || newEntities.length > 0;
  
  if (!hasContent) return null;

  return (
    <div className="space-y-8">
      {/* Hidden Gems Section */}
      {hiddenGems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Gem className="w-6 h-6 text-emerald-500" />
            <div>
              <h2 className="text-2xl font-bold">Hidden Gems</h2>
              <p className="text-muted-foreground text-sm">Quality discoveries waiting to be found</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hiddenGems.map((entity) => (
              <div key={entity.id} className="relative">
                <ProductCard
                  entity={entity}
                  onClick={() => onEntityView(entity.id, entity.type)}
                />
                <div className="absolute top-2 right-2">
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-emerald-100 text-emerald-800 flex items-center gap-1"
                  >
                    <Gem className="w-3 h-3" />
                    Hidden Gem
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New This Week Section */}
      {newEntities.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-2xl font-bold">New This Week</h2>
              <p className="text-muted-foreground text-sm">Fresh additions to discover</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {newEntities.map((entity) => (
              <div key={entity.id} className="relative">
                <ProductCard
                  entity={entity}
                  onClick={() => onEntityView(entity.id, entity.type)}
                />
                <div className="absolute top-2 right-2">
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-blue-100 text-blue-800 flex items-center gap-1"
                  >
                    <Clock className="w-3 h-3" />
                    New
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
