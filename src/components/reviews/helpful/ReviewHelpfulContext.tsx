import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthPrompt } from '@/contexts/AuthPromptContext';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { useToast } from '@/hooks/use-toast';
import { toggleReviewLike, fetchReviewHelpfulState } from '@/services/review/interactions';
import { performHelpfulToggle } from '@/services/review/helpfulToggle';
import { entityDetailQueryKey } from '@/hooks/use-entity-detail-cached';
import type { ReviewWithUser } from '@/types/entities';

interface ReviewHelpfulContextValue {
  viewerId: string | null;
  isPending: (reviewId: string) => boolean;
  toggle: (review: ReviewWithUser) => void;
}

const ReviewHelpfulContext = createContext<ReviewHelpfulContextValue | null>(null);

export const useReviewHelpful = () => useContext(ReviewHelpfulContext);

/**
 * One Helpful state owner per entity page. Counts and selection live in the
 * viewer-scoped entity-detail cache; pending is shared per root review id.
 */
export const ReviewHelpfulProvider: React.FC<{ entitySlug: string; children: React.ReactNode }> = ({
  entitySlug,
  children,
}) => {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const queryClient = useQueryClient();
  const { requireAuth } = useAuthPrompt();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();
  const { toast } = useToast();

  const viewerRef = useRef<string | null>(viewerId);
  viewerRef.current = viewerId;
  const pendingRef = useRef<Set<string>>(new Set());
  const [, setTick] = useState(0);

  // A new session never inherits the previous session's pending votes.
  useEffect(() => {
    pendingRef.current = new Set();
    setTick((t) => t + 1);
  }, [viewerId]);

  const toggle = useCallback(
    (review: ReviewWithUser) => {
      if (!requireAuth({ action: 'helpful_review', surface: 'entity_review_card' })) return;
      if (!canPerformAction('canLikeContent')) {
        showVerificationRequired('canLikeContent');
        return;
      }
      const startViewer = viewerRef.current;
      if (!startViewer || review.user_id === startViewer || review.visibility !== 'public') return;
      const key = entityDetailQueryKey(entitySlug, startViewer);
      const pending = pendingRef.current;
      void performHelpfulToggle({
        reviewId: review.id,
        viewerId: startViewer,
        getCurrentViewerId: () => viewerRef.current,
        pending,
        onPendingChange: () => setTick((t) => t + 1),
        cancelReads: () => queryClient.cancelQueries({ queryKey: key }),
        read: () => {
          const data = queryClient.getQueryData<{ reviews?: ReviewWithUser[] }>(key);
          const r = data?.reviews?.find((x) => x.id === review.id);
          return r ? { likes: r.likes || 0, isLiked: !!r.isLiked } : null;
        },
        write: (next) =>
          queryClient.setQueryData<any>(key, (old: any) =>
            old?.reviews
              ? {
                  ...old,
                  reviews: old.reviews.map((r: ReviewWithUser) =>
                    r.id === review.id ? { ...r, likes: next.likes, isLiked: next.isLiked } : r
                  ),
                }
              : old
          ),
        toggle: (id) => toggleReviewLike(id),
        fetchState: fetchReviewHelpfulState,
        invalidate: () => void queryClient.invalidateQueries({ queryKey: key }),
        notifyError: (kind) =>
          toast({
            title: kind === 'rejected' ? "Couldn't update Helpful" : "Couldn't confirm your Helpful vote",
            description: kind === 'rejected' ? 'Please try again.' : "We'll refresh it shortly.",
            variant: 'destructive',
          }),
      });
    },
    [entitySlug, queryClient, requireAuth, canPerformAction, showVerificationRequired, toast]
  );

  const value = useMemo<ReviewHelpfulContextValue>(
    () => ({ viewerId, isPending: (id) => pendingRef.current.has(id), toggle }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewerId, toggle, pendingRef.current.size]
  );

  return <ReviewHelpfulContext.Provider value={value}>{children}</ReviewHelpfulContext.Provider>;
};
