
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { useNavigate } from 'react-router-dom';
import { StarIcon } from 'lucide-react';
import { isGooglePlacesImage } from '@/utils/imageUtils';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { Entity } from '@/services/recommendation/types'; 

// Extended entity interface with photo_reference which might come from Google Places API
interface ExtendedEntity extends Omit<Entity, 'metadata'> {
  metadata?: Record<string, any>;
  photo_reference?: string;
}

export const FeaturedEntities = () => {
  const [entities, setEntities] = useState<ExtendedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { refreshEntityImage } = useEntityImageRefresh();

  useEffect(() => {
    const fetchFeaturedEntities = async () => {
      try {
        const { data, error } = await supabase
          .from('entities')
          .select('*')
          .order('popularity_score', { ascending: false })
          .limit(3);
        
        if (error) throw error;
        
        // Check if any entities have Google Places images that might need refreshing
        const entitiesToUpdate = data?.filter(entity => 
          entity.image_url && 
          isGooglePlacesImage(entity.image_url) && 
          entity.api_source === 'google_places' && 
          entity.api_ref
        );
        
        if (entitiesToUpdate && entitiesToUpdate.length > 0) {
          // Process one entity to avoid rate limiting
          const entityToRefresh = entitiesToUpdate[0];
          
          try {
            // Safely extract photo_reference from metadata and ensure it's a string
            let photoRef: string | undefined = undefined;
            
            if (entityToRefresh.metadata && 
                typeof entityToRefresh.metadata === 'object' && 
                !Array.isArray(entityToRefresh.metadata) &&
                entityToRefresh.metadata.photo_reference !== undefined) {
              // Convert to string if it's a number or boolean
              photoRef = String(entityToRefresh.metadata.photo_reference);
            }
            
            const newImageUrl = await refreshEntityImage(
              entityToRefresh.id, 
              entityToRefresh.api_ref,
              photoRef
            );
            
            if (newImageUrl) {
              // Update the image URL in our local state
              const updatedEntities = data.map(entity => 
                entity.id === entityToRefresh.id 
                  ? { ...entity, image_url: newImageUrl } 
                  : entity
              ) as ExtendedEntity[];
              
              setEntities(updatedEntities);
              return;
            }
          } catch (refreshError) {
            console.error("Error refreshing entity image:", refreshError);
          }
        }
        
        // Cast the data to ExtendedEntity[] to satisfy TypeScript
        setEntities(data as ExtendedEntity[] || []);
      } catch (error) {
        console.error('Error fetching featured entities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedEntities();
  }, []);

  const handleEntityClick = (entity: Entity) => {
    navigate(`/entity/${entity.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Featured</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <div className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (entities.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">Featured</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {entities.map((entity) => (
          <Card 
            key={entity.id}
            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleEntityClick(entity)}
          >
            <div className="h-48 relative">
              <ImageWithFallback
                src={entity.image_url || ''}
                alt={entity.name}
                className="h-full w-full object-cover"
                fallbackSrc="/placeholder.svg"
                entityType={entity.type}
              />
              <Badge className="absolute top-2 right-2 bg-background/80 text-foreground backdrop-blur-sm">
                {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
              </Badge>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg truncate">{entity.name}</h3>
              {entity.venue && (
                <p className="text-sm text-muted-foreground truncate">{entity.venue}</p>
              )}
              {entity.metadata?.rating && (
                <div className="flex items-center mt-2">
                  <StarIcon className="h-4 w-4 text-yellow-400 mr-1" />
                  <span className="text-sm font-medium">{entity.metadata.rating}</span>
                  {entity.metadata.user_ratings_total && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({entity.metadata.user_ratings_total})
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
