
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import ImageWithFallback from '@/components/common/ImageWithFallback';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface CategoryHighlightsProps {
  type: EntityTypeString;
  limit?: number;
}

export const CategoryHighlights = ({ type, limit = 3 }: CategoryHighlightsProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('recommendations')
          .select(`
            id, 
            title, 
            rating, 
            category,
            entity_id,
            image_url,
            entities (
              id,
              name,
              venue,
              type,
              slug
            )
          `)
          .eq('category', type)
          .eq('visibility', 'public')
          .order('view_count', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Error fetching recommendations:', error);
          return;
        }

        setItems(data || []);
      } catch (err) {
        console.error('Error in fetching recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [type, limit]);

  const handleRecommendationClick = (item: any) => {
    navigate(`/recommendations/${item.id}`);
  };
  
  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Top {type === 'place' ? 'Places' : `${type.charAt(0).toUpperCase() + type.slice(1)}s`}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: limit }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex p-4">
                <Skeleton className="h-24 w-24 rounded-lg flex-shrink-0" />
                <div className="ml-4 flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-32 mb-2" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Top {type === 'place' ? 'Places' : `${type.charAt(0).toUpperCase() + type.slice(1)}s`}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card 
            key={item.id} 
            className="overflow-hidden cursor-pointer transition-all hover:shadow-md"
            onClick={() => handleRecommendationClick(item)}
          >
            <div className="flex p-4">
              <div className="h-24 w-24 rounded-lg overflow-hidden flex-shrink-0">
                <ImageWithFallback
                  src={item.image_url || (item.entities ? item.entities.image_url : null)}
                  fallbackSrc="/placeholder.svg"
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="font-medium text-base line-clamp-1">{item.title}</h3>
                {item.entities && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {item.entities.venue || item.entities.name}
                  </p>
                )}
                <div className="mt-2 flex items-center">
                  <ConnectedRingsRating rating={item.rating} size="sm" />
                  <Badge variant="outline" className="ml-2 text-xs font-normal">
                    {item.category}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
