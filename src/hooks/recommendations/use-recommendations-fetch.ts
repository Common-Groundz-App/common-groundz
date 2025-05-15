
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Recommendation,
  fetchUserRecommendations,
  RecommendationCategory
} from '@/services/recommendationService';

interface UseRecommendationsFetchProps {
  profileUserId?: string;
  category?: string | RecommendationCategory;
  limit?: number;
}

export const useRecommendationsFetch = ({ 
  profileUserId,
  category,
  limit
}: UseRecommendationsFetchProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState<Error | null>(null);
  
  // Define sortBy with the proper type
  const sortBy: 'latest' | 'oldest' | 'highest_rated' = 'latest';
  
  // Make sure profileUserId is a string
  const safeProfileUserId = profileUserId || '';
  
  // Fetch recommendations using React Query
  const { 
    data,
    isLoading,
    error: queryError,
    isError,
    refetch
  } = useQuery({
    queryKey: ['recommendations', safeProfileUserId, user?.id, category, limit],
    queryFn: () => fetchUserRecommendations(
      user?.id || null, 
      safeProfileUserId, 
      category, 
      sortBy,
      undefined, 
      limit
    ),
    enabled: !!safeProfileUserId,
    retry: 2, // Retry failed requests up to 2 times
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
  
  // Update state when data is fetched
  useEffect(() => {
    if (data?.recommendations && Array.isArray(data.recommendations)) {
      console.log(`Setting ${data.recommendations.length} recommendations`);
      setRecommendations(data.recommendations);
      setError(null);
    } else if (data && 'recommendations' in data && !data.recommendations) {
      console.warn('Received empty recommendations array');
      setRecommendations([]);
    }
  }, [data]);
  
  // Handle errors
  useEffect(() => {
    if (queryError) {
      console.error('Error in useRecommendationsFetch:', queryError);
      setError(queryError instanceof Error ? queryError : new Error('Failed to fetch recommendations'));
      toast({
        title: 'Error loading recommendations',
        description: 'Please refresh the page or try again later.',
        variant: 'destructive'
      });
    }
  }, [queryError, toast]);

  // Refresh recommendations function
  const refreshRecommendations = async () => {
    try {
      await refetch();
    } catch (err) {
      console.error('Error refreshing recommendations:', err);
    }
  };

  return {
    recommendations,
    setRecommendations,
    isLoading,
    error,
    isError,
    refetch,
    refreshRecommendations,
    data
  };
};
