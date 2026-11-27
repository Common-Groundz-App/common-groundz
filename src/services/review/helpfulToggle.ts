import type { ToggleReviewLikeResult, ReviewHelpfulState } from './interactions';

export interface HelpfulSnapshot {
  likes: number;
  isLiked: boolean;
}

export interface HelpfulToggleDeps {
  reviewId: string;
  /** Viewer that started the vote; every write is dropped if it changes. */
  viewerId: string;
  getCurrentViewerId: () => string | null;
  pending: Set<string>;
  onPendingChange?: () => void;
  cancelReads: () => Promise<void>;
  read: () => HelpfulSnapshot | null;
  write: (next: HelpfulSnapshot) => void;
  toggle: (reviewId: string) => Promise<ToggleReviewLikeResult>;
  fetchState: (reviewIds: string[], viewerId: string) => Promise<Map<string, ReviewHelpfulState>>;
  invalidate: () => void;
  notifyError: (kind: 'rejected' | 'unconfirmed') => void;
}

export type HelpfulToggleOutcome =
  | 'skipped_pending'
  | 'skipped_missing'
  | 'viewer_changed'
  | 'confirmed'
  | 'rejected'
  | 'reconciled'
  | 'unconfirmed';

/**
 * One Helpful vote: optimistic write, single toggle (never retried), then
 * authoritative reconciliation. Pending is shared per root review id.
 */
export async function performHelpfulToggle(d: HelpfulToggleDeps): Promise<HelpfulToggleOutcome> {
  if (d.pending.has(d.reviewId)) return 'skipped_pending';
  d.pending.add(d.reviewId);
  d.onPendingChange?.();
  const sameViewer = () => d.getCurrentViewerId() === d.viewerId;
  try {
    await d.cancelReads();
    const prev = d.read();
    if (!prev) return 'skipped_missing';
    if (!sameViewer()) return 'viewer_changed';
    const optimisticLiked = !prev.isLiked;
    d.write({
      isLiked: optimisticLiked,
      likes: Math.max(0, prev.likes + (optimisticLiked ? 1 : -1)),
    });

    const result = await d.toggle(d.reviewId);
    if (!sameViewer()) return 'viewer_changed';

    if (!('error' in result)) {
      const current = d.read();
      d.write({ isLiked: result.isLiked, likes: current?.likes ?? prev.likes });
      try {
        const state = (await d.fetchState([d.reviewId], d.viewerId)).get(d.reviewId);
        if (!sameViewer()) return 'viewer_changed';
        // The toggle response is authoritative for selection; the read for the count.
        if (state) d.write({ isLiked: result.isLiked, likes: state.count });
      } catch {
        if (sameViewer()) d.invalidate();
      }
      return 'confirmed';
    }

    if ('error' in result && !result.ambiguous) {
      d.write(prev);
      d.notifyError('rejected');
      return 'rejected';
    }

    // Ambiguous: the vote may have committed. Read, never re-toggle.
    try {
      const state = (await d.fetchState([d.reviewId], d.viewerId)).get(d.reviewId);
      if (!sameViewer()) return 'viewer_changed';
      if (!state) throw new Error('missing');
      d.write({ isLiked: !!state.isLiked, likes: state.count });
      return 'reconciled';
    } catch {
      if (!sameViewer()) return 'viewer_changed';
      d.write(prev);
      d.invalidate();
      d.notifyError('unconfirmed');
      return 'unconfirmed';
    }
  } finally {
    d.pending.delete(d.reviewId);
    d.onPendingChange?.();
  }
}
