import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { EntityResultItem } from './EntityResultItem';
import { Link2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Entity {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  description?: string;
  category_id?: string;
  venue?: string;
  slug?: string;
}

interface RelatedEntitiesProps {
  currentQuery: string;
  activeTab: string;
  limit?: number;
}

export const RelatedEntities: React.FC<RelatedEntitiesProps> = ({
  currentQuery,
  activeTab,
  limit = 6
}) => {
  const [relatedEntities, setRelatedEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRelatedEntities = async () => {
      if (!currentQuery.trim()) return;
      
      try {
        setLoading(true);
        
        // Use a simple approach to find related entities
        // 1. Find entities with similar names or in similar categories
        // 2. Find entities that appear together in recommendations/reviews
        
        let query = supabase
          .from('entities')
          .select('id, name, type, image_url, description, category_id, venue, slug')
          .eq('is_deleted', false)
          .eq('approval_status', 'approved')
          .neq('name', currentQuery); // Exclude exact matches

        // Filter by type if specific tab is selected
        if (activeTab !== 'all' && ['book', 'movie', 'place', 'product', 'food', 'tv_show', 'course', 'app', 'game', 'experience', 'brand'].includes(activeTab)) {
          query = query.eq('type', activeTab as any);
        }

        // Use text search for related content
        const { data, error } = await query
          .textSearch('name', currentQuery.split(' ').join(' | '), {
            type: 'websearch',
            config: 'english'
          })
          .limit(limit);

        if (error) {
          // Fallback to simpler search if text search fails
          const { data: fallbackData } = await supabase
            .from('entities')
            .select('id, name, type, image_url, description, category_id, venue, slug')
            .eq('is_deleted', false)
            .eq('approval_status', 'approved')
            .ilike('name', `%${currentQuery}%`)
            .neq('name', currentQuery)
            .limit(limit);
          
          setRelatedEntities(fallbackData || []);
        } else {
          setRelatedEntities(data || []);
        }
        
      } catch (error) {
        console.error('Error fetching related entities:', error);
        setRelatedEntities([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchRelatedEntities();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentQuery, activeTab, limit]);

  if (loading || relatedEntities.length === 0) return null;

  return (
    <div className="mb-6 p-4 border rounded-lg bg-gradient-to-br from-background to-muted/20">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium">Related to "{currentQuery}"</h3>
        <Badge variant="outline" className="text-xs">
          <Sparkles className="w-3 h-3 mr-1" />
          Discovered
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {relatedEntities.map((entity) => (
          <div key={entity.id} className="border rounded-md overflow-hidden hover:shadow-sm transition-shadow">
            <EntityResultItem
              entity={{
                ...entity,
                venue: entity.venue || null,
                slug: entity.slug || null,
                image_url: entity.image_url || null,
                description: entity.description || null
              }}
              onClick={() => {}}
            />
          </div>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-3">
        Found {relatedEntities.length} related {activeTab === 'all' ? 'items' : activeTab}
      </p>
    </div>
  );
};