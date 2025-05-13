
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Recommendation,
  fetchUserRecommendations
} from '@/services/recommendationService';

interface UseRecommendationsFetchProps {
  profileUserId: string;
}

export const useRecommendationsFetch = ({ profileUserId }: UseRecommendationsFetchProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  
  // Use React Query for caching recommendations
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['recommendations', profileUserId, user?.id],
    queryFn: async () => {
      if (!profileUserId) return [];
      return await fetchUserRecommendations(user?.id || null, profileUserId);
    },
    enabled: !!profileUserId,
    staleTime: 2 * 60 * 1000, // Keep recommendations fresh for 2 minutes
    onSuccess: (data) => {
      setRecommendations(data || []);
    },
    onError: (err) => {
      console.error('Error in useRecommendationsFetch:', err);
      toast({
        title: 'Error',
        description: 'Failed to load recommendations. Please try again.',
        variant: 'destructive'
      });
    }
  });

  return {
    recommendations,
    setRecommendations,
    isLoading,
    error,
    refreshRecommendations: refetch
  };
};
