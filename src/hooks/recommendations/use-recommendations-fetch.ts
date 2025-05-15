
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
  
  // Fetch recommendations using React Query
  const { 
    data,
    isLoading,
    error: queryError,
    isError,
    refetch
  } = useQuery({
    queryKey: ['recommendations', profileUserId, user?.id, category, limit],
    queryFn: () => fetchUserRecommendations(
      user?.id || null, 
      profileUserId || '', 
      category, 
      sortBy,
      undefined, 
      limit
    ),
    enabled: !!profileUserId,
  });
  
  // Update state when data is fetched
  useEffect(() => {
    if (data) {
      setRecommendations(data.recommendations);
      setError(null);
    }
  }, [data]);
  
  // Handle errors
  useEffect(() => {
    if (queryError) {
      console.error('Error in useRecommendationsFetch:', queryError);
      setError(queryError instanceof Error ? queryError : new Error('Failed to fetch recommendations'));
      toast({
        title: 'Error',
        description: 'Failed to load recommendations. Please try again.',
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
