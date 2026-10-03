/**
 * One signal for "a review or timeline entry changed". Every review write path
 * (create, edit, status/visibility, delete, timeline add, timeline undo) calls
 * notifyReviewsChanged() after a successful write; CacheProvider listens and
 * refreshes entity pages so their live stats never wait for the hourly summary.
 */
export const REVIEWS_CHANGED_EVENT = 'groundz:reviews-changed';

export const notifyReviewsChanged = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REVIEWS_CHANGED_EVENT));
};
