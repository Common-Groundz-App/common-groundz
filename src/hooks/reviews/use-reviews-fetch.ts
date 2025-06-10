
import { useQuery } from '@tanstack/react-query';
import { fetchReviews } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';

interface UseReviewsFetchProps {
  profileUserId: string;
  enabled?: boolean;
}

export const useReviewsFetch = ({ profileUserId, enabled = true }: UseReviewsFetchProps) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['reviews', profileUserId, user?.id],
    queryFn: () => fetchReviews(profileUserId, user?.id || undefined),
    enabled: !!profileUserId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
