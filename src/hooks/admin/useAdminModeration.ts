import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ModerationMetrics {
  pendingFlagsCount: number;
  resolvedFlagsCount: number;
  highPriorityFlagsCount: number;
  pendingDuplicatesCount: number;
  totalUsersWithReputation: number;
  avgUserReputation: number;
  contentQualityScore: number;
}

export const useAdminModeration = () => {
  const [metrics, setMetrics] = useState<ModerationMetrics>({
    pendingFlagsCount: 0,
    resolvedFlagsCount: 0,
    highPriorityFlagsCount: 0,
    pendingDuplicatesCount: 0,
    totalUsersWithReputation: 0,
    avgUserReputation: 0,
    contentQualityScore: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchModerationMetrics = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.rpc('get_moderation_metrics');
      
      if (error) {
        console.error('Error fetching moderation metrics:', error);
        toast({
          title: "Error",
          description: "Failed to fetch moderation metrics",
          variant: "destructive",
        });
        return;
      }

      if (data && data.length > 0) {
        const result = data[0];
        setMetrics({
          pendingFlagsCount: Number(result.pending_flags_count || 0),
          resolvedFlagsCount: Number(result.resolved_flags_count || 0),
          highPriorityFlagsCount: Number(result.high_priority_flags_count || 0),
          pendingDuplicatesCount: Number(result.pending_duplicates_count || 0),
          totalUsersWithReputation: Number(result.total_users_with_reputation || 0),
          avgUserReputation: Number(result.avg_user_reputation || 0),
          contentQualityScore: Number(result.content_quality_score || 0),
        });
      }
    } catch (error) {
      console.error('Error in fetchModerationMetrics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch moderation metrics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModerationMetrics();
  }, []);

  return {
    metrics,
    isLoading,
    refetch: fetchModerationMetrics,
  };
};