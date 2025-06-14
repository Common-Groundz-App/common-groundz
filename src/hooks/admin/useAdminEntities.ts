
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
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
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

  const generateBulkEntitySummaries = async () => {
    setIsBulkGenerating(true);
    
    try {
      console.log('🚀 Starting bulk AI summary generation for entities...');
      
      // Get eligible entities (those with dynamic reviews but no summary)
      const eligibleEntities = entities.filter(
        entity => entity.dynamic_review_count >= 2 && !entity.ai_dynamic_review_summary
      );

      if (eligibleEntities.length === 0) {
        toast({
          title: "No Entities to Process",
          description: "All eligible entities already have AI summaries",
        });
        return;
      }

      console.log(`📋 Found ${eligibleEntities.length} entities eligible for bulk generation`);

      let successCount = 0;
      let failureCount = 0;
      const failedIds: string[] = [];

      // Process entities with delay to avoid rate limits
      for (const entity of eligibleEntities) {
        try {
          const { error: summaryError } = await supabase.functions.invoke('generate-entity-ai-summary', {
            body: { entityId: entity.id }
          });

          if (summaryError) {
            throw summaryError;
          }

          successCount++;
          console.log(`✅ Generated summary for entity: ${entity.name}`);
        } catch (error) {
          console.error(`❌ Failed to generate summary for entity ${entity.id}:`, error);
          failureCount++;
          failedIds.push(entity.id);
        }

        // Add delay between requests to avoid rate limits
        if (eligibleEntities.indexOf(entity) < eligibleEntities.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Show completion toast
      if (failureCount === 0) {
        toast({
          title: "Bulk Generation Complete",
          description: `${successCount} entity summaries generated successfully`,
        });
      } else {
        toast({
          title: "Bulk Generation Complete",
          description: `${successCount} summaries generated, ${failureCount} failed`,
          variant: "destructive"
        });
        
        // Log failed IDs for debugging
        if (failedIds.length > 0) {
          console.log('❌ Failed entity IDs:', failedIds);
        }
      }

      // Refresh data
      await fetchEntities();

    } catch (error) {
      console.error('❌ Error in bulk entity summary generation:', error);
      toast({
        title: "Error",
        description: "Failed to start bulk generation",
        variant: "destructive"
      });
    } finally {
      setIsBulkGenerating(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  return {
    entities,
    isLoading,
    isGenerating,
    isBulkGenerating,
    generateEntitySummary,
    generateBulkEntitySummaries,
    refetch: fetchEntities
  };
};
