
import { supabase } from '@/integrations/supabase/client';
import { toggleLike, toggleSave } from '@/services/recommendationService';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

export function useInteractions(refreshFeed: () => void) {
  const { toast } = useToast();
  
  const handleLike = useCallback(async (id: string, userId: string | undefined) => {
    if (!userId) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like recommendations',
        variant: 'destructive'
      });
      return false;
    }

    try {
      const { data: item } = await supabase
        .from('recommendation_likes')
        .select('*')
        .eq('recommendation_id', id)
        .eq('user_id', userId)
        .single();
        
      const isLiked = !!item;
      
      await toggleLike(id, userId, isLiked);
      return true;
    } catch (err) {
      console.error('Error toggling like:', err);
      refreshFeed();
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  const handleSave = useCallback(async (id: string, userId: string | undefined) => {
    if (!userId) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save recommendations',
        variant: 'destructive'
      });
      return false;
    }

    try {
      const { data: item } = await supabase
        .from('recommendation_saves')
        .select('*')
        .eq('recommendation_id', id)
        .eq('user_id', userId)
        .single();
        
      const isSaved = !!item;
      
      await toggleSave(id, userId, isSaved);
      return true;
    } catch (err) {
      console.error('Error toggling save:', err);
      refreshFeed();
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  return {
    handleLike,
    handleSave
  };
}
