
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUserReviews } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';

interface UseReviewsFetchProps {
  profileUserId: string;
  enabled?: boolean;
}

export const useReviewsFetch = ({ profileUserId, enabled = true }: UseReviewsFetchProps) => {
  const { user, isLoading: authLoading } = useAuth();
  const client = useQueryClient();
  const viewer = user?.id ?? 'guest';
  useEffect(() => {
    const previous = (q: { queryKey: readonly unknown[] }) => q.queryKey[0] === 'reviews' && q.queryKey[2] !== viewer;
    void client.cancelQueries({ predicate: previous });
    client.removeQueries({ predicate: previous });
  }, [client, viewer]);
  
  return useQuery({
    queryKey: ['reviews', profileUserId, viewer],
    queryFn: () => fetchUserReviews(user?.id || null, profileUserId),
    enabled: !!profileUserId && enabled && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
