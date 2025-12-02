import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useUserRoutines = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: routines, isLoading, error } = useQuery({
    queryKey: ['user-routines', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_routines')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const createRoutine = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      category: string;
      frequency: string;
      time_of_day?: string;
      steps?: any[];
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: result, error } = await supabase
        .from('user_routines')
        .insert({
          user_id: user.id,
          routine_name: data.name,
          description: data.description,
          category: data.category,
          frequency: data.frequency,
          time_of_day: data.time_of_day,
          steps: data.steps || [],
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-routines', user?.id] });
      toast({
        title: 'Routine Created',
        description: 'Your routine has been created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create routine',
        variant: 'destructive',
      });
      console.error('Error creating routine:', error);
    },
  });

  const updateRoutine = useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      description?: string;
      category?: string;
      frequency?: string;
      time_of_day?: string;
      steps?: any[];
    }) => {
      const { data: result, error } = await supabase
        .from('user_routines')
        .update({
          routine_name: data.name,
          description: data.description,
          category: data.category,
          frequency: data.frequency,
          time_of_day: data.time_of_day,
          steps: data.steps,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-routines', user?.id] });
      toast({
        title: 'Updated',
        description: 'Routine updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update routine',
        variant: 'destructive',
      });
      console.error('Error updating routine:', error);
    },
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_routines')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-routines', user?.id] });
      toast({
        title: 'Deleted',
        description: 'Routine deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete routine',
        variant: 'destructive',
      });
      console.error('Error deleting routine:', error);
    },
  });

  return {
    routines,
    isLoading,
    error,
    createRoutine: createRoutine.mutate,
    updateRoutine: updateRoutine.mutate,
    deleteRoutine: deleteRoutine.mutate,
  };
};
