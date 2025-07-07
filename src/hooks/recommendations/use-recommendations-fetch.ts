
import { useState, useEffect } from 'react';
import { 
  fetchUserRecommendations,
  Recommendation,
  RecommendationCategory 
} from '@/services/recommendationService';
import { useAuth } from '@/contexts/AuthContext';

interface UseRecommendationsFetchProps {
  profileUserId?: string;
  category?: string | RecommendationCategory;
  limit?: number;
}

export const useRecommendationsFetch = ({
  profileUserId,
  category,
  limit
}: UseRecommendationsFetchProps = {}) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = profileUserId || user?.id;

  const fetchRecommendations = async () => {
    if (!targetUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const fetchedRecommendations = await fetchUserRecommendations(targetUserId);
      
      let filteredRecommendations = fetchedRecommendations;
      
      // Apply category filter if provided
      if (category) {
        filteredRecommendations = fetchedRecommendations.filter(rec => 
          rec.category === category
        );
      }
      
      // Apply limit if provided
      if (limit) {
        filteredRecommendations = filteredRecommendations.slice(0, limit);
      }
      
      setRecommendations(filteredRecommendations);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to fetch recommendations');
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [targetUserId, category, limit]);

  const refreshRecommendations = () => {
    fetchRecommendations();
  };

  return {
    recommendations,
    isLoading,
    error,
    refreshRecommendations
  };
};
