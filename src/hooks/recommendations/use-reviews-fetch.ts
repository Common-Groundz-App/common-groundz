
import { useQuery } from '@tanstack/react-query';
import { Review, fetchUserReviews } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';

interface UseReviewsFetchProps {
  profileUserId: string;
  enabled?: boolean;
}

export function useReviewsFetch({ profileUserId, enabled = true }: UseReviewsFetchProps) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['reviews', profileUserId],
    queryFn: () => fetchUserReviews(user?.id || null, profileUserId),
    enabled: enabled && !!profileUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
