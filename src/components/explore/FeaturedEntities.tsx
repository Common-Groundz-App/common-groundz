
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Link } from 'react-router-dom';
import { EntityType } from '@/services/recommendation/types';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { Skeleton } from '@/components/ui/skeleton';

interface FeaturedEntitiesProps {
  type: EntityType | EntityTypeString;
  limit?: number;
  title?: string;
}

export function FeaturedEntities({ type, limit = 5, title }: FeaturedEntitiesProps) {
  const { data: entities, isLoading } = useQuery({
    queryKey: ['featured-entities', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('type', type as string)
        .eq('is_deleted', false)
        .order('popularity_score', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">{title || `Featured ${type.charAt(0).toUpperCase() + type.slice(1)}s`}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!entities || entities.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">{title || `Featured ${type.charAt(0).toUpperCase() + type.slice(1)}s`}</h3>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-2 md:-ml-4">
          {entities.map((entity) => (
            <CarouselItem key={entity.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3">
              <Link to={`/entity/${entity.slug || entity.id}`}>
                <Card className="overflow-hidden h-full hover:shadow-md transition-shadow">
                  <div className="aspect-video relative bg-muted">
                    {entity.image_url ? (
                      <img 
                        src={entity.image_url} 
                        alt={entity.name} 
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-muted text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h4 className="font-medium truncate">{entity.name}</h4>
                    {entity.venue && (
                      <p className="text-sm text-muted-foreground truncate">{entity.venue}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-4" />
        <CarouselNext className="hidden md:flex -right-4" />
      </Carousel>
    </div>
  );
}
