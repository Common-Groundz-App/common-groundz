
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface OptimisticInteractionState {
  isLiked: boolean;
  isSaved: boolean;
  likeCount: number;
  saveCount: number;
}

interface UseOptimisticInteractionsProps {
  entityId: string;
  entityType: 'recommendation' | 'review' | 'post';
  initialState: OptimisticInteractionState;
  onLike: (entityId: string, isLiked: boolean) => Promise<void>;
  onSave: (entityId: string, isSaved: boolean) => Promise<void>;
}

export const useOptimisticInteractions = ({
  entityId,
  entityType,
  initialState,
  onLike,
  onSave
}: UseOptimisticInteractionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [optimisticState, setOptimisticState] = useState(initialState);

  // Optimistic like mutation
  const likeMutation = useMutation({
    mutationFn: async (newLikedState: boolean) => {
      await onLike(entityId, newLikedState);
    },
    onMutate: async (newLikedState: boolean) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [entityType, entityId] });
      
      // Snapshot previous state
      const previousState = optimisticState;
      
      // Optimistically update
      setOptimisticState(prev => ({
        ...prev,
        isLiked: newLikedState,
        likeCount: newLikedState ? prev.likeCount + 1 : prev.likeCount - 1
      }));
      
      return { previousState };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousState) {
        setOptimisticState(context.previousState);
      }
      toast({
        title: 'Action failed',
        description: 'Please try again',
        variant: 'destructive'
      });
    },
    onSuccess: () => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: [entityType] });
      queryClient.invalidateQueries({ queryKey: ['user-interactions'] });
    }
  });

  // Optimistic save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSavedState: boolean) => {
      await onSave(entityId, newSavedState);
    },
    onMutate: async (newSavedState: boolean) => {
      await queryClient.cancelQueries({ queryKey: [entityType, entityId] });
      
      const previousState = optimisticState;
      
      setOptimisticState(prev => ({
        ...prev,
        isSaved: newSavedState,
        saveCount: newSavedState ? prev.saveCount + 1 : prev.saveCount - 1
      }));
      
      return { previousState };
    },
    onError: (error, variables, context) => {
      if (context?.previousState) {
        setOptimisticState(context.previousState);
      }
      toast({
        title: 'Action failed',
        description: 'Please try again',
        variant: 'destructive'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityType] });
      queryClient.invalidateQueries({ queryKey: ['user-interactions'] });
    }
  });

  const handleLike = useCallback(() => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like items',
      });
      return;
    }
    
    likeMutation.mutate(!optimisticState.isLiked);
  }, [user, optimisticState.isLiked, likeMutation, toast]);

  const handleSave = useCallback(() => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save items',
      });
      return;
    }
    
    saveMutation.mutate(!optimisticState.isSaved);
  }, [user, optimisticState.isSaved, saveMutation, toast]);

  return {
    ...optimisticState,
    handleLike,
    handleSave,
    isLiking: likeMutation.isPending,
    isSaving: saveMutation.isPending,
    isOptimistic: likeMutation.isPending || saveMutation.isPending
  };
};
