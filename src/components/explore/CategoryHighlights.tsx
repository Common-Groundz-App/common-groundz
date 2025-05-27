import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { StarIcon } from 'lucide-react';
import { EntityTypeString } from '@/hooks/feed/api/types';

interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
  image_url?: string;
  venue?: string;
  metadata?: any;
}

interface CategoryHighlightsProps {
  entityType?: EntityTypeString;
}

export const CategoryHighlights: React.FC<CategoryHighlightsProps> = ({ entityType }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEntitiesByType = async () => {
      try {
        setIsLoading(true);
        
        const query = supabase
          .from('entities')
          .select('*')
          .order('popularity_score', { ascending: false })
          .limit(6);
        
        // If a specific entity type is provided, filter by that type
        // Cast to the allowed Supabase type to avoid TypeScript errors
        if (entityType) {
          query.eq('type', entityType as any);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        console.log(`CategoryHighlights: Fetched ${data?.length || 0} entities for type: ${entityType || 'all'}`);
        setEntities(data || []);
      } catch (error) {
        console.error('Error fetching entities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntitiesByType();
  }, [entityType]);

  const handleEntityClick = (entity: Entity) => {
    navigate(`/entity/${entity.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {!entityType && <h2 className="text-xl font-semibold mb-4">Popular Places & Things</h2>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <div className="p-3">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">No items found for this category.</p>
      </div>
    );
  }

  // Group entities by type for the main "Featured" page view
  const entitiesByType = entities.reduce((groups: Record<string, Entity[]>, entity) => {
    const type = entity.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(entity);
    return groups;
  }, {});

  // If a specific entity type is provided, just show those entities
  if (entityType) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {entities.map((entity) => (
            <Card 
              key={entity.id}
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleEntityClick(entity)}
            >
              <div className="h-32 relative">
                <ImageWithFallback
                  src={entity.image_url || ''}
                  alt={entity.name}
                  className="h-full w-full object-cover"
                  fallbackSrc="/placeholder.svg"
                  entityType={entity.type}
                />
              </div>
              <div className="p-3">
                <h3 className="font-medium text-sm truncate">{entity.name}</h3>
                {entity.venue && (
                  <p className="text-xs text-muted-foreground truncate">{entity.venue}</p>
                )}
                {entity.metadata?.rating && (
                  <div className="flex items-center mt-1">
                    <StarIcon className="h-3 w-3 text-yellow-400 mr-1" />
                    <span className="text-xs font-medium">{entity.metadata.rating}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // For the main view, show sections by entity type
  return (
    <div className="space-y-8">
      {Object.entries(entitiesByType).map(([type, typeEntities]) => (
        <div key={type} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {type.charAt(0).toUpperCase() + type.slice(1)}s
            </h2>
            <button 
              className="text-sm text-primary hover:underline"
              onClick={() => navigate('/explore')}
            >
              See all
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {typeEntities.slice(0, 3).map((entity) => (
              <Card 
                key={entity.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleEntityClick(entity)}
              >
                <div className="h-32 relative">
                  <ImageWithFallback
                    src={entity.image_url || ''}
                    alt={entity.name}
                    className="h-full w-full object-cover"
                    fallbackSrc="/placeholder.svg"
                    entityType={entity.type}
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{entity.name}</h3>
                  {entity.venue && (
                    <p className="text-xs text-muted-foreground truncate">{entity.venue}</p>
                  )}
                  {entity.metadata?.rating && (
                    <div className="flex items-center mt-1">
                      <StarIcon className="h-3 w-3 text-yellow-400 mr-1" />
                      <span className="text-xs font-medium">{entity.metadata.rating}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
