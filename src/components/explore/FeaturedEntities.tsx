
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { StarIcon } from 'lucide-react';

interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
  image_url?: string;
  venue?: string;
  metadata?: any;
  popularity_score?: number;
}

export const FeaturedEntities = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeaturedEntities = async () => {
      try {
        const { data, error } = await supabase
          .from('entities')
          .select('*')
          .order('popularity_score', { ascending: false })
          .limit(3);
        
        if (error) throw error;
        setEntities(data || []);
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
