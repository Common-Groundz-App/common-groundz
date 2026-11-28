import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthPrompt } from '@/contexts/AuthPromptContext';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { useToast } from '@/hooks/use-toast';
import { toggleReviewLike, fetchReviewHelpfulState } from '@/services/review/interactions';
import { performHelpfulToggle, type HelpfulSnapshot } from '@/services/review/helpfulToggle';
import { helpfulQueryKey, helpfulSession, emitHelpful, isViewerReviewKey, writeHelpfulSnapshot, type HelpfulReview } from '@/services/review/helpfulCache';

interface ReviewHelpfulContextValue {
  viewerId: string | null;
  authLoading: boolean;
  isPending: (reviewId: string) => boolean;
  toggle: (review: HelpfulReview, surface?: string) => void;
}
const ReviewHelpfulContext = createContext<ReviewHelpfulContextValue | null>(null);
export const useReviewHelpful = () => useContext(ReviewHelpfulContext);

/** One session coordinator, shared even when cards and modal use separate portals/providers. */
export const ReviewHelpfulProvider: React.FC<{ entitySlug?: string; children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const viewerId = user?.id ?? null;
  const client = useQueryClient();
  const session = helpfulSession(client);
  const { requireAuth } = useAuthPrompt();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();
  const { toast } = useToast();
  // Render-time epoch change blocks old callbacks even before effects run (including A → B → A).
  if (session.viewer !== viewerId) {
    session.viewer = viewerId;
    session.epoch++;
    session.pending = new Set();
    session.versions = new Map();
  }
  useSyncExternalStore(
    useCallback(listener => { session.listeners.add(listener); return () => { session.listeners.delete(listener); }; }, [session]),
    () => session.revision,
  );
  useEffect(() => {
    const stale = (q: { queryKey: readonly unknown[] }) =>
      ['reviews', 'entity-detail', 'review-helpful'].includes(String(q.queryKey[0])) &&
      q.queryKey.length === 3 && q.queryKey[2] !== (viewerId ?? 'guest');
    void client.cancelQueries({ predicate: stale });
    client.removeQueries({ predicate: stale });
    emitHelpful(client);
  }, [client, viewerId]);

  const toggle = useCallback((review: HelpfulReview, surface = 'entity_review_card') => {
    if (!requireAuth({ action: 'helpful_review', surface })) return;
    if (authLoading || !viewerId || review.user_id === viewerId || review.visibility !== 'public') return;
    if (!canPerformAction('canLikeContent')) { showVerificationRequired('canLikeContent'); return; }
    const epoch = session.epoch;
    const pending = session.pending;
    void performHelpfulToggle({
      reviewId: review.id,
      viewerId,
      getCurrentViewerId: () => session.epoch === epoch ? session.viewer ?? null : null,
      pending,
      onPendingChange: () => {
        session.versions.set(review.id, (session.versions.get(review.id) ?? 0) + 1);
        emitHelpful(client);
      },
      cancelReads: () => client.cancelQueries({ predicate: q => isViewerReviewKey(q.queryKey, viewerId) }),
      read: () => client.getQueryData<HelpfulSnapshot>(helpfulQueryKey(review.id, viewerId)) ?? null,
      write: next => writeHelpfulSnapshot(client, review.id, viewerId, next),
      toggle: id => toggleReviewLike(id),
      fetchState: fetchReviewHelpfulState,
      invalidate: () => { void client.invalidateQueries({ predicate: q => isViewerReviewKey(q.queryKey, viewerId) }); },
      notifyError: kind => toast({
        title: kind === 'rejected' ? "Couldn't update Helpful" : "Couldn't confirm your Helpful vote",
        description: kind === 'rejected' ? 'Please try again.' : "We'll refresh it shortly.",
        variant: 'destructive',
      }),
    });
  }, [authLoading, viewerId, session, client, requireAuth, canPerformAction, showVerificationRequired, toast]);
  const value = useMemo(() => ({ viewerId, authLoading: !!authLoading, isPending: (id: string) => session.pending.has(id), toggle }),
    [viewerId, authLoading, session, session.revision, toggle]);
  return <ReviewHelpfulContext.Provider value={value}>{children}</ReviewHelpfulContext.Provider>;
};

/** Cards seed the shared query; Details refresh it. Missing data is never a fabricated zero. */
export function useHelpfulSnapshot(review: HelpfulReview, reconcile = false) {
  const { user, isLoading: authLoading } = useAuth();
  const viewer = user?.id ?? null;
  const client = useQueryClient();
  const session = helpfulSession(client);
  const key = helpfulQueryKey(review.id, viewer);
  const query = useQuery<HelpfulSnapshot>({
    queryKey: key,
    initialData: () => {
      if (authLoading) return undefined;
      if (typeof review.likes === 'number') return { likes: review.likes, isLiked: !!viewer && !!review.isLiked };
      for (const [, data] of client.getQueriesData({ predicate: q => isViewerReviewKey(q.queryKey, viewer) && q.queryKey[0] !== 'review-helpful' })) {
        const rows = Array.isArray(data) ? data : data && typeof data === 'object' && 'reviews' in data ? data.reviews : [];
        const found = Array.isArray(rows) ? rows.find((r: HelpfulReview) => r.id === review.id && r.visibility === 'public') : undefined;
        if (found && typeof found.likes === 'number') return { likes: found.likes, isLiked: !!viewer && !!found.isLiked };
      }
      return undefined;
    },
    queryFn: async ({ signal }) => {
      const epoch = session.epoch;
      const version = session.versions.get(review.id) ?? 0;
      const state = (await fetchReviewHelpfulState([review.id], viewer)).get(review.id);
      if (signal.aborted || epoch !== session.epoch) throw new Error('Helpful read cancelled');
      if (version !== (session.versions.get(review.id) ?? 0) || session.pending.has(review.id)) {
        const current = client.getQueryData<HelpfulSnapshot>(key);
        if (current) return current;
        throw new Error('Helpful mutation in progress');
      }
      if (!state) throw new Error('Helpful state unavailable');
      const next = { likes: state.count, isLiked: !!viewer && !!state.isLiked };
      writeHelpfulSnapshot(client, review.id, viewer, next);
      return next;
    },
    enabled: reconcile && !authLoading && review.visibility === 'public' && !session.pending.has(review.id),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
  });
  useEffect(() => {
    if (!reconcile) return;
    return () => { void client.cancelQueries({ queryKey: key, exact: true }); };
  }, [client, review.id, viewer, reconcile]);
  return { data: authLoading ? undefined : query.data, error: query.error };
}
