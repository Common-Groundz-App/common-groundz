import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useMyStuff = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading, error } = useQuery({
    queryKey: ['my-stuff', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_stuff')
        .select(`
          *,
          entity:entities(
            id,
            name,
            slug,
            type,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const addToMyStuff = useMutation({
    mutationFn: async (data: {
      entity_id: string;
      status: string;
      sentiment_score?: number;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: result, error } = await supabase
        .from('user_stuff')
        .insert({
          user_id: user.id,
          entity_id: data.entity_id,
          status: data.status,
          sentiment_score: data.sentiment_score || 0,
          source: 'manual',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-stuff', user?.id] });
      toast({
        title: 'Added to My Stuff',
        description: 'Item successfully added to your inventory',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to add item to My Stuff',
        variant: 'destructive',
      });
      console.error('Error adding to my stuff:', error);
    },
  });

  const updateMyStuffItem = useMutation({
    mutationFn: async (data: {
      id: string;
      status?: string;
      sentiment_score?: number;
    }) => {
      const { data: result, error } = await supabase
        .from('user_stuff')
        .update({
          status: data.status,
          sentiment_score: data.sentiment_score,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-stuff', user?.id] });
      toast({
        title: 'Updated',
        description: 'Item successfully updated',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
      console.error('Error updating my stuff item:', error);
    },
  });

  const removeFromMyStuff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_stuff')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-stuff', user?.id] });
      toast({
        title: 'Removed',
        description: 'Item removed from My Stuff',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to remove item',
        variant: 'destructive',
      });
      console.error('Error removing from my stuff:', error);
    },
  });

  return {
    items,
    isLoading,
    error,
    addToMyStuff: addToMyStuff.mutate,
    updateMyStuffItem: updateMyStuffItem.mutate,
    removeFromMyStuff: removeFromMyStuff.mutate,
  };
};
