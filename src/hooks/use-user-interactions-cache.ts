
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserInteractionData {
  likedRecommendations: Set<string>;
  savedRecommendations: Set<string>;
  likedReviews: Set<string>;
  savedReviews: Set<string>;
  likedPosts: Set<string>;
  savedPosts: Set<string>;
}

export const useUserInteractionsCache = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all user interactions at once
  const {
    data: interactions,
    isLoading,
    error
  } = useQuery({
    queryKey: ['user-interactions', user?.id],
    queryFn: async (): Promise<UserInteractionData> => {
      if (!user?.id) {
        return {
          likedRecommendations: new Set(),
          savedRecommendations: new Set(),
          likedReviews: new Set(),
          savedReviews: new Set(),
          likedPosts: new Set(),
          savedPosts: new Set(),
        };
      }

      const [
        recLikes,
        recSaves,
        reviewLikes,
        reviewSaves,
        postLikes,
        postSaves
      ] = await Promise.all([
        supabase.from('recommendation_likes').select('recommendation_id').eq('user_id', user.id),
        supabase.from('recommendation_saves').select('recommendation_id').eq('user_id', user.id),
        supabase.from('review_likes').select('review_id').eq('user_id', user.id),
        supabase.from('review_saves').select('review_id').eq('user_id', user.id),
        supabase.from('post_likes').select('post_id').eq('user_id', user.id),
        supabase.from('post_saves').select('post_id').eq('user_id', user.id),
      ]);

      return {
        likedRecommendations: new Set(recLikes.data?.map(item => item.recommendation_id) || []),
        savedRecommendations: new Set(recSaves.data?.map(item => item.recommendation_id) || []),
        likedReviews: new Set(reviewLikes.data?.map(item => item.review_id) || []),
        savedReviews: new Set(reviewSaves.data?.map(item => item.review_id) || []),
        likedPosts: new Set(postLikes.data?.map(item => item.post_id) || []),
        savedPosts: new Set(postSaves.data?.map(item => item.post_id) || []),
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });

  // Optimistic update mutations
  const updateInteractionCache = useMutation({
    mutationFn: async ({ 
      type, 
      itemId, 
      action 
    }: { 
      type: 'recommendation' | 'review' | 'post';
      itemId: string;
      action: 'like' | 'save';
    }) => {
      // This is handled optimistically, actual DB update happens elsewhere
      return { type, itemId, action };
    },
    onMutate: async ({ type, itemId, action }) => {
      if (!user?.id || !interactions) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user-interactions', user.id] });

      // Snapshot the previous value
      const previousInteractions = queryClient.getQueryData(['user-interactions', user.id]);

      // Optimistically update the cache
      queryClient.setQueryData(['user-interactions', user.id], (old: UserInteractionData | undefined) => {
        if (!old) return old;

        const newInteractions = { ...old };
        const setKey = action === 'like' ? 
          (`liked${type.charAt(0).toUpperCase() + type.slice(1)}s` as keyof UserInteractionData) :
          (`saved${type.charAt(0).toUpperCase() + type.slice(1)}s` as keyof UserInteractionData);

        const currentSet = new Set(old[setKey] as Set<string>);
        
        if (currentSet.has(itemId)) {
          currentSet.delete(itemId);
        } else {
          currentSet.add(itemId);
        }
        
        newInteractions[setKey] = currentSet as any;
        return newInteractions;
      });

      return { previousInteractions };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousInteractions && user?.id) {
        queryClient.setQueryData(['user-interactions', user.id], context.previousInteractions);
      }
    },
  });

  // Helper functions to check interaction status
  const isLiked = (type: 'recommendation' | 'review' | 'post', itemId: string): boolean => {
    if (!interactions) return false;
    const setKey = `liked${type.charAt(0).toUpperCase() + type.slice(1)}s` as keyof UserInteractionData;
    return (interactions[setKey] as Set<string>).has(itemId);
  };

  const isSaved = (type: 'recommendation' | 'review' | 'post', itemId: string): boolean => {
    if (!interactions) return false;
    const setKey = `saved${type.charAt(0).toUpperCase() + type.slice(1)}s` as keyof UserInteractionData;
    return (interactions[setKey] as Set<string>).has(itemId);
  };

  const invalidateInteractions = () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['user-interactions', user.id] });
    }
  };

  return {
    interactions,
    isLoading,
    error,
    isLiked,
    isSaved,
    updateInteractionCache: updateInteractionCache.mutate,
    invalidateInteractions
  };
};
