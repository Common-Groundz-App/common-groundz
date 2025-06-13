
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminEntity {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  dynamic_review_count: number;
  ai_dynamic_review_summary?: string;
  ai_dynamic_review_summary_last_generated_at?: string;
  ai_dynamic_review_summary_model_used?: string;
}

export const useAdminEntities = () => {
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const fetchEntities = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Fetching entities with dynamic reviews...');
      
      // Get entities that have at least one review with has_timeline = true
      const { data, error } = await supabase
        .from('entities')
        .select(`
          id,
          name,
          type,
          image_url,
          ai_dynamic_review_summary,
          ai_dynamic_review_summary_last_generated_at,
          ai_dynamic_review_summary_model_used
        `)
        .eq('is_deleted', false)
        .order('name');

      if (error) {
        console.error('❌ Error fetching entities:', error);
        throw error;
      }

      if (!data?.length) {
        console.log('ℹ️ No entities found');
        setEntities([]);
        return;
      }

      // For each entity, count dynamic reviews
      const entitiesWithCounts = await Promise.all(
        data.map(async (entity) => {
          const { count, error: countError } = await supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('entity_id', entity.id)
            .eq('has_timeline', true)
            .eq('status', 'published');

          if (countError) {
            console.error(`❌ Error counting reviews for entity ${entity.id}:`, countError);
            return {
              ...entity,
              dynamic_review_count: 0
            };
          }

          return {
            ...entity,
            dynamic_review_count: count || 0
          };
        })
      );

      // Filter to only include entities with at least one dynamic review
      const entitiesWithDynamicReviews = entitiesWithCounts.filter(
        entity => entity.dynamic_review_count > 0
      );

      console.log(`✅ Found ${entitiesWithDynamicReviews.length} entities with dynamic reviews`);
      setEntities(entitiesWithDynamicReviews);

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

  const generateEntitySummary = async (entityId: string) => {
    setIsGenerating(prev => ({ ...prev, [entityId]: true }));
    
    try {
      console.log(`🤖 Generating AI summary for entity: ${entityId}`);
      
      const { data, error } = await supabase.functions.invoke('generate-entity-ai-summary', {
        body: { entityId }
      });

      if (error) {
        console.error('❌ Error generating entity summary:', error);
        throw error;
      }

      console.log('✅ Entity summary generated successfully:', data);
      
      toast({
        title: 'Success',
        description: 'Entity summary generated successfully'
      });

      // Refresh the entities list to show updated summary
      await fetchEntities();

    } catch (error) {
      console.error('❌ Error in generateEntitySummary:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate entity summary',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(prev => ({ ...prev, [entityId]: false }));
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  return {
    entities,
    isLoading,
    isGenerating,
    generateEntitySummary,
    refetch: fetchEntities
  };
};
