
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityType } from '@/services/recommendation/types';

interface CategoryHighlightsProps {
  category: EntityType | string;
  limit?: number;
}

export function CategoryHighlights({ category, limit = 6 }: CategoryHighlightsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['category-highlights', category],
    queryFn: async () => {
      // This is a simplified query - in production we might have actual categories table
      // Here we're just grouping by some characteristic of entities
      let field = 'venue';
      if (category === 'product') {
        field = 'name'; // Fallback for products which might not have venue
      }
      
      const { data, error } = await supabase
        .from('entities')
        .select(`
          ${field}, 
          image_url,
          id,
          slug
        `)
        .eq('type', category)
        .eq('is_deleted', false)
        .not('image_url', 'is', null)
        .order('popularity_score', { ascending: false })
        .limit(50); // Get more then deduplicate
      
      if (error) throw error;
      
      // Deduplicate by the main field and take the first unique entries
      const uniqueMap = new Map();
      data?.forEach(item => {
        if (item[field] && !uniqueMap.has(item[field])) {
          uniqueMap.set(item[field], item);
        }
      });
      
      // Convert map to array and take limited items
      return Array.from(uniqueMap.values()).slice(0, limit);
    },
  });
  
  if (isLoading) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Browse by Category</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }
  
  const getCategoryLabel = () => {
    switch (category) {
      case 'place': return 'Popular Locations';
      case 'food': return 'Food Categories';
      case 'product': return 'Product Categories';
      default: return 'Browse Categories';
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-4">{getCategoryLabel()}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
        {data.map((item) => {
          const displayField = item.venue || item.name;
          if (!displayField) return null;
          
          return (
            <Link 
              to={`/search?q=${encodeURIComponent(displayField)}&type=${category}`} 
              key={item.id}
              className="block"
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                <div className="aspect-[3/2] relative">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={displayField} 
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="bg-muted w-full h-full flex items-center justify-center">
                      <span className="text-muted-foreground">No image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                    <CardContent className="p-3 text-white">
                      <h4 className="font-medium text-sm md:text-base truncate">{displayField}</h4>
                    </CardContent>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
