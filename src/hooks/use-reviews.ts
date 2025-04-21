
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { Review } from '@/services/reviewService';
import { 
  fetchUserReviews, 
  toggleReviewLike, 
  toggleReviewSave,
  convertReviewToRecommendation 
} from '@/services/reviewService';

interface UseReviewsProps {
  profileUserId: string;
}

export const useReviews = ({ profileUserId }: UseReviewsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReviews = async () => {
    if (!profileUserId) return;
    
    try {
      setIsLoading(true);
      const data = await fetchUserReviews(profileUserId, user?.id || null);
      setReviews(data);
      setError(null);
    } catch (err) {
      console.error('Error in useReviews:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch reviews'));
      toast({
        title: 'Error',
        description: 'Failed to load reviews. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profileUserId) {
      fetchReviews();
    }
  }, [profileUserId, user?.id]);

  // Handle like action
  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like reviews',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = reviews.find(r => r.id === id);
      if (!item) return;

      // Optimistic update
      setReviews(prev => 
        prev.map(item => {
          if (item.id === id) {
            const isLiked = !item.isLiked;
            return {
              ...item,
              isLiked,
              likes: (item.likes || 0) + (isLiked ? 1 : -1)
            };
          }
          return item;
        })
      );

      // Server update
      await toggleReviewLike(id, user.id, !!item.isLiked);
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert on failure
      fetchReviews();
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle save action
  const handleSave = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save reviews',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = reviews.find(r => r.id === id);
      if (!item) return;

      // Optimistic update
      setReviews(prev => 
        prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              isSaved: !item.isSaved
            };
          }
          return item;
        })
      );

      // Server update
      await toggleReviewSave(id, user.id, !!item.isSaved);
    } catch (err) {
      console.error('Error toggling save:', err);
      // Revert on failure
      fetchReviews();
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Convert to recommendation
  const convertToRecommendation = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to convert reviews',
        variant: 'destructive'
      });
      return;
    }

    try {
      await convertReviewToRecommendation(id, user.id);
      
      toast({
        title: 'Success',
        description: 'Review successfully converted to recommendation'
      });
      
      // Refresh the list
      fetchReviews();
    } catch (err) {
      console.error('Error converting review:', err);
      toast({
        title: 'Error',
        description: 'Failed to convert review. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return {
    reviews,
    isLoading,
    error,
    handleLike,
    handleSave,
    refreshReviews: fetchReviews,
    convertToRecommendation
  };
};
