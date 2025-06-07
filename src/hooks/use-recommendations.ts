
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fetchUserRecommendations, toggleReviewLike, toggleReviewSave, Review } from '@/services/reviewService';

interface UseRecommendationsProps {
  profileUserId?: string;
  category?: string;
  limit?: number;
}

export const useRecommendations = ({ 
  profileUserId,
  category,
  limit
}: UseRecommendationsProps = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecommendations = async () => {
    if (!profileUserId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching recommendations for profileUserId:', profileUserId);
      
      let data = await fetchUserRecommendations(user?.id || null, profileUserId);
      
      // Apply category filter if specified
      if (category) {
        data = data.filter(item => item.category === category);
      }
      
      // Apply limit if specified
      if (limit) {
        data = data.slice(0, limit);
      }
      
      console.log('Fetched recommendations:', data.length);
      setRecommendations(data);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to like recommendations",
        variant: "destructive"
      });
      return;
    }

    try {
      // Optimistic update
      setRecommendations(prev => prev.map(item => {
        if (item.id === id) {
          const isLiked = !item.isLiked;
          return {
            ...item,
            isLiked,
            likes: isLiked 
              ? (item.likes || 0) + 1 
              : Math.max(0, (item.likes || 0) - 1)
          };
        }
        return item;
      }));

      // Server update
      await toggleReviewLike(id, user.id);
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert on failure
      fetchRecommendations();
      toast({
        title: "Error",
        description: "Failed to update like status",
        variant: "destructive"
      });
    }
  };

  const handleSave = async (id: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save recommendations",
        variant: "destructive"
      });
      return;
    }

    try {
      // Optimistic update
      setRecommendations(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            isSaved: !item.isSaved,
          };
        }
        return item;
      }));

      // Server update
      await toggleReviewSave(id, user.id);
    } catch (err) {
      console.error('Error toggling save:', err);
      // Revert on failure
      fetchRecommendations();
      toast({
        title: "Error",
        description: "Failed to update save status",
        variant: "destructive"
      });
    }
  };

  const refreshRecommendations = () => {
    fetchRecommendations();
  };

  useEffect(() => {
    fetchRecommendations();
  }, [profileUserId, category, limit, user?.id]);

  return {
    recommendations,
    isLoading,
    error,
    handleLike,
    handleSave,
    refreshRecommendations
  };
};
