
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import { useNavigate } from 'react-router-dom';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeaturedEntitiesProps {
  type: EntityTypeString;
  title: string;
  limit?: number;
}

export const FeaturedEntities = ({ type, title, limit = 5 }: FeaturedEntitiesProps) => {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('entities')
          .select('id, name, description, image_url, venue, type, metadata, slug')
          .eq('type', type as "movie" | "book" | "food" | "product" | "place") // Cast to allowed type literals
          .eq('is_deleted', false)
          .order('popularity_score', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Error fetching entities:', error);
          return;
        }

        setEntities(data || []);
      } catch (err) {
        console.error('Error in fetching entities:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [type, limit]);

  const handleEntityClick = (entity: any) => {
    if (entity.slug) {
      navigate(`/entity/${entity.slug}`);
    } else {
      navigate(`/entity/${entity.id}`);
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: limit }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <CardContent className="p-3">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
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
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {entities.map((entity) => {
          const rating = entity.metadata?.average_rating || entity.metadata?.rating;
          
          return (
            <Card 
              key={entity.id} 
              className="overflow-hidden cursor-pointer transition-all hover:shadow-md"
              onClick={() => handleEntityClick(entity)}
            >
              <div className="relative h-32 overflow-hidden">
                <ImageWithFallback
                  src={entity.image_url}
                  fallbackSrc="/placeholder.svg"
                  alt={entity.name}
                  className="h-full w-full object-cover"
                />
                
                {rating && (
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center">
                    <Star className="w-3 h-3 mr-1 text-yellow-400" />
                    <span>{typeof rating === 'number' ? rating.toFixed(1) : rating}</span>
                  </div>
                )}
              </div>
              
              <CardContent className={cn("p-3", entity.type === 'food' && "pt-2")}>
                {entity.type === 'food' && entity.venue && (
                  <p className="text-xs text-muted-foreground mb-0.5 truncate">{entity.venue}</p>
                )}
                <h3 className="font-medium text-sm truncate">{entity.name}</h3>
                {entity.venue && entity.type !== 'food' && (
                  <p className="text-xs text-muted-foreground truncate">{entity.venue}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
