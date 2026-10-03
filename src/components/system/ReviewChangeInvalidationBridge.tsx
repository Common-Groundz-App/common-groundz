import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { REVIEWS_CHANGED_EVENT } from '@/services/review/reviewChangeEvents';

/**
 * The one listener for REVIEWS_CHANGED_EVENT. Every successful review or
 * timeline write emits that event; this bridge only invalidates the queries
 * that show reviews (verified keys):
 *   - ['entity-detail', slug]  entity page reviews + live stats
 *   - ['reviews', ...]         profile review lists (useReviewsFetch)
 *   - ['entity-stats', id]     sidebar stats on post detail
 * No polling, cache warming, visibility listeners, re-emits or reloads.
 */
const ReviewChangeInvalidationBridge = () => {
  const queryClient = useQueryClient();
  useEffect(() => {
    const handle = () => {
      queryClient.invalidateQueries({ queryKey: ['entity-detail'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['entity-stats'] });
    };
    window.addEventListener(REVIEWS_CHANGED_EVENT, handle);
    return () => window.removeEventListener(REVIEWS_CHANGED_EVENT, handle);
  }, [queryClient]);
  return null;
};

export default ReviewChangeInvalidationBridge;
