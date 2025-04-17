
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Recommendation,
  fetchRecommendationWithLikesAndSaves,
  fetchUserRecommendations
} from '@/services/recommendationService';

interface UseRecommendationsFetchProps {
  profileUserId: string;
}

export const useRecommendationsFetch = ({ profileUserId }: UseRecommendationsFetchProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch recommendations
  const fetchRecommendations = async () => {
    if (!profileUserId) return;
    
    try {
      setIsLoading(true);
      // Use fetchUserRecommendations instead of fetchRecommendationWithLikesAndSaves
      // because it returns a direct array of recommendations
      const data = await fetchUserRecommendations(
        user?.id || null, 
        profileUserId
      );
      setRecommendations(data);
      setError(null);
    } catch (err) {
      console.error('Error in useRecommendationsFetch:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch recommendations'));
      toast({
        title: 'Error',
        description: 'Failed to load recommendations. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profileUserId) {
      fetchRecommendations();
    }
  }, [profileUserId, user?.id]);

  return {
    recommendations,
    setRecommendations,
    isLoading,
    error,
    refreshRecommendations: fetchRecommendations
  };
};
