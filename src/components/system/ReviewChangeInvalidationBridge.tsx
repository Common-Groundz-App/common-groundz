import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      queryClient.invalidateQueries({ queryKey: ['user-entity-review'] });
    };
    window.addEventListener(REVIEWS_CHANGED_EVENT, handle);
    // Owner-private reviews never outlive the session: cancel in-flight
    // requests first so a late response cannot repopulate the cache.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      const key = ['user-entity-review'];
      void queryClient.cancelQueries({ queryKey: key });
      queryClient.removeQueries({ queryKey: key });
    });
    return () => {
      window.removeEventListener(REVIEWS_CHANGED_EVENT, handle);
      subscription.unsubscribe();
    };
  }, [queryClient]);
  return null;
};

export default ReviewChangeInvalidationBridge;
