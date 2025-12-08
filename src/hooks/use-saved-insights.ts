import { useState, useEffect, useCallback } from 'react';
import { savedInsightsService, SavedInsight, SaveInsightParams } from '@/services/savedInsightsService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useSavedInsights() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [insights, setInsights] = useState<SavedInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await savedInsightsService.getSavedInsights();
      setInsights(data);
    } catch (err) {
      setError(err as Error);
      console.error('[useSavedInsights] Error fetching insights:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const saveInsight = async (params: SaveInsightParams) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save insights',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const saved = await savedInsightsService.saveInsight(params);
      if (saved) {
        setInsights(prev => [saved, ...prev]);
        toast({
          title: 'Insight saved',
          description: 'Added to your saved insights',
        });
      }
      return saved;
    } catch (err) {
      toast({
        title: 'Error saving insight',
        description: 'Please try again',
        variant: 'destructive',
      });
      return null;
    }
  };

  const removeInsight = async (id: string) => {
    try {
      await savedInsightsService.removeInsight(id);
      setInsights(prev => prev.filter(i => i.id !== id));
      toast({
        title: 'Insight removed',
        description: 'Removed from your saved insights',
      });
    } catch (err) {
      toast({
        title: 'Error removing insight',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    try {
      await savedInsightsService.updateInsightNotes(id, notes);
      setInsights(prev => prev.map(i => 
        i.id === id ? { ...i, notes } : i
      ));
    } catch (err) {
      toast({
        title: 'Error updating notes',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return {
    insights,
    isLoading,
    error,
    saveInsight,
    removeInsight,
    updateNotes,
    refetch: fetchInsights,
  };
}
