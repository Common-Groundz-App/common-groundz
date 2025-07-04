
import { useState } from 'react';
import { useAdminEntities } from './useAdminEntities';
import { useToast } from '@/hooks/use-toast';
import { UseAdminEntitiesPanelReturn } from '@/types/admin';

export const useAdminEntitiesPanel = (): UseAdminEntitiesPanelReturn => {
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const { toast } = useToast();
  
  // Get entities with dynamic reviews (filter could be added here)
  const { entities, isLoading, refetch } = useAdminEntities({
    // Could add filter for entities with reviews here
  });

  const generateEntitySummary = async (entityId: string) => {
    setIsGenerating(prev => ({ ...prev, [entityId]: true }));
    
    try {
      console.log(`🤖 Generating AI summary for entity: ${entityId}`);
      
      // TODO: Call the generate-entity-ai-summary edge function
      // For now, just simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: 'Success',
        description: 'AI summary generated successfully',
        variant: 'default'
      });
      
      // Refetch to get updated data
      await refetch();
      
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate AI summary',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(prev => ({ ...prev, [entityId]: false }));
    }
  };

  const generateBulkEntitySummaries = async () => {
    setIsBulkGenerating(true);
    
    try {
      console.log(`🤖 Generating bulk AI summaries for ${entities.length} entities`);
      
      // TODO: Call bulk generation or iterate through entities
      // For now, just simulate the process
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      toast({
        title: 'Success',
        description: `Bulk AI summary generation completed for ${entities.length} entities`,
        variant: 'default'
      });
      
      // Refetch to get updated data
      await refetch();
      
    } catch (error) {
      console.error('❌ Error generating bulk AI summaries:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate bulk AI summaries',
        variant: 'destructive'
      });
    } finally {
      setIsBulkGenerating(false);
    }
  };

  return {
    entities,
    isLoading,
    isGenerating,
    isBulkGenerating,
    generateEntitySummary,
    generateBulkEntitySummaries,
    refetch
  };
};
