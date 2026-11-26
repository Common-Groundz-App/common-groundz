import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserEntityReviewForCard } from '@/services/ownerPrivateReview';

export const USER_ENTITY_REVIEW_KEY = 'user-entity-review';

/**
 * Signed-in author's private review for this entity (Phase 10.2 data path;
 * the pinned card UI is Phase 10.4). Account-scoped key, runs only once auth
 * has resolved, and on any account change cancels in-flight requests before
 * evicting every cached private review so nothing crosses accounts.
 */
export function useUserEntityReview(entityId: string | undefined) {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const prevUser = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    if (prevUser.current !== undefined && prevUser.current !== userId) {
      const key = [USER_ENTITY_REVIEW_KEY];
      void queryClient.cancelQueries({ queryKey: key });
      queryClient.removeQueries({ queryKey: key });
    }
    prevUser.current = userId;
  }, [userId, authLoading, queryClient]);

  const query = useQuery({
    queryKey: [USER_ENTITY_REVIEW_KEY, entityId, userId],
    queryFn: ({ signal }) => fetchUserEntityReviewForCard(entityId!, userId!, signal),
    enabled: Boolean(entityId && userId && !authLoading),
    staleTime: 30_000,
  });

  // Never expose data for a different account than the one signed in now.
  const data = query.data && userId && query.data.user_id === userId ? query.data : null;
  return { privateReview: data, isLoading: query.isLoading && query.fetchStatus !== 'idle' };
}
