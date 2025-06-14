
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminDashboardMetrics {
  totalDynamicReviews: number;
  reviewsWithAISummary: number;
  totalEntitiesWithDynamicReviews: number;
  entitiesWithAISummary: number;
  pendingSummaries: number;
  lastSummaryGeneration: string | null;
}

export const useAdminDashboard = () => {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics>({
    totalDynamicReviews: 0,
    reviewsWithAISummary: 0,
    totalEntitiesWithDynamicReviews: 0,
    entitiesWithAISummary: 0,
    pendingSummaries: 0,
    lastSummaryGeneration: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Fetching admin dashboard metrics...');

      // Get dynamic reviews metrics
      const { count: totalDynamicReviews } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('has_timeline', true)
        .eq('status', 'published');

      const { count: reviewsWithAISummary } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('has_timeline', true)
        .eq('status', 'published')
        .not('ai_summary', 'is', null);

      // Get entities with dynamic reviews
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('id, ai_dynamic_review_summary')
        .eq('is_deleted', false);

      if (entitiesError) throw entitiesError;

      // Count entities that have at least one dynamic review
      const entitiesWithCounts = await Promise.all(
        (entitiesData || []).map(async (entity) => {
          const { count } = await supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('entity_id', entity.id)
            .eq('has_timeline', true)
            .eq('status', 'published');

          return {
            ...entity,
            dynamicReviewCount: count || 0
          };
        })
      );

      const entitiesWithDynamicReviews = entitiesWithCounts.filter(e => e.dynamicReviewCount > 0);
      const entitiesWithAISummary = entitiesWithDynamicReviews.filter(e => e.ai_dynamic_review_summary);

      // Get last summary generation timestamp
      const { data: lastGeneration } = await supabase
        .from('admin_actions')
        .select('created_at')
        .in('action_type', ['generate_ai_summary', 'generate_entity_ai_summary'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const pendingReviews = (totalDynamicReviews || 0) - (reviewsWithAISummary || 0);
      const pendingEntities = entitiesWithDynamicReviews.length - entitiesWithAISummary.length;

      setMetrics({
        totalDynamicReviews: totalDynamicReviews || 0,
        reviewsWithAISummary: reviewsWithAISummary || 0,
        totalEntitiesWithDynamicReviews: entitiesWithDynamicReviews.length,
        entitiesWithAISummary: entitiesWithAISummary.length,
        pendingSummaries: pendingReviews + pendingEntities,
        lastSummaryGeneration: lastGeneration?.created_at || null
      });

      console.log('✅ Admin dashboard metrics loaded successfully');

    } catch (error) {
      console.error('❌ Error fetching admin dashboard metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch dashboard metrics',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return {
    metrics,
    isLoading,
    refetch: fetchMetrics
  };
};
