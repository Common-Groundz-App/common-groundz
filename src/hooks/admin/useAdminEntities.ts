
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Entity } from '@/services/recommendation/types';

interface UseAdminEntitiesOptions {
  searchQuery?: string;
  filterType?: string;
  includeDeleted?: boolean;
}

export const useAdminEntities = (options: UseAdminEntitiesOptions = {}) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchEntities = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Fetching admin entities...');
      
      // Build the query based on options
      let query = supabase
        .from('entities')
        .select('*')
        .order('name');

      // Apply filters based on options
      if (!options.includeDeleted) {
        query = query.eq('is_deleted', false);
      }

      if (options.filterType && options.filterType !== 'all') {
        query = query.eq('type', options.filterType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching admin entities:', error);
        throw error;
      }

      if (!data?.length) {
        console.log('ℹ️ No entities found');
        setEntities([]);
        return;
      }

      // Convert database entities to Entity type
      const formattedEntities: Entity[] = data.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        description: entity.description || undefined,
        image_url: entity.image_url || undefined,
        venue: entity.venue || undefined,
        slug: entity.slug || undefined,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
        is_deleted: entity.is_deleted,
        is_verified: entity.is_verified || false,
        api_source: entity.api_source || undefined,
        api_ref: entity.api_ref || undefined,
        metadata: entity.metadata || {},
        created_by: entity.created_by || undefined,
        category_id: entity.category_id || undefined,
        popularity_score: entity.popularity_score || undefined,
        website_url: entity.website_url || undefined,
        open_graph_data: entity.open_graph_data || undefined,
        verification_date: entity.verification_date || undefined,
        authors: entity.authors || undefined,
        publication_year: entity.publication_year || undefined,
        isbn: entity.isbn || undefined,
        languages: entity.languages || undefined,
        ingredients: entity.ingredients || undefined,
        nutritional_info: entity.nutritional_info || undefined,
        price_info: entity.price_info || undefined,
        specifications: entity.specifications || undefined,
        cast_crew: entity.cast_crew || undefined,
        external_ratings: entity.external_ratings || undefined,
        enrichment_source: entity.enrichment_source || undefined,
        last_enriched_at: entity.last_enriched_at || undefined,
        data_quality_score: entity.data_quality_score || undefined,
        trending_score: entity.trending_score || undefined,
        last_trending_update: entity.last_trending_update || undefined,
        view_velocity: entity.view_velocity || undefined,
        recent_views_24h: entity.recent_views_24h || undefined,
        recent_likes_24h: entity.recent_likes_24h || undefined,
        recent_recommendations_24h: entity.recent_recommendations_24h || undefined,
        geographic_boost: entity.geographic_boost || undefined,
        seasonal_boost: entity.seasonal_boost || undefined,
        photo_reference: entity.photo_reference || undefined,
        ai_dynamic_review_summary: entity.ai_dynamic_review_summary || undefined,
        ai_dynamic_review_summary_last_generated_at: entity.ai_dynamic_review_summary_last_generated_at || undefined,
        ai_dynamic_review_summary_model_used: entity.ai_dynamic_review_summary_model_used || undefined
      }));

      // Apply client-side search filter if provided
      let filteredEntities = formattedEntities;
      if (options.searchQuery && options.searchQuery.trim()) {
        const searchLower = options.searchQuery.toLowerCase();
        filteredEntities = formattedEntities.filter(entity => 
          entity.name.toLowerCase().includes(searchLower) ||
          entity.description?.toLowerCase().includes(searchLower) ||
          false
        );
      }

      console.log(`✅ Found ${filteredEntities.length} admin entities`);
      setEntities(filteredEntities);

    } catch (error) {
      console.error('❌ Error in fetchEntities:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch entities',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, [options.searchQuery, options.filterType, options.includeDeleted]);

  return {
    entities,
    isLoading,
    refetch: fetchEntities
  };
};
