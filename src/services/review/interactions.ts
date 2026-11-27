import { supabase } from '@/integrations/supabase/client';

/**
 * Helpful (review_likes) client contract.
 * `success: false` is never a valid unvote: callers must branch on `success`.
 * `ambiguous` means the server may have committed (network/timeout); callers
 * must re-read state, never re-run the toggle.
 */
export type ToggleReviewLikeResult =
  | { success: true; isLiked: boolean }
  | { success: false; error: string; ambiguous: boolean };

export interface ReviewHelpfulState {
  count: number;
  /** null when no viewer is signed in. */
  isLiked: boolean | null;
}

// PostgREST/Postgres rejections carry a code; transport failures do not.
const isConfirmedRejection = (error: { code?: string | null } | null | undefined) =>
  !!error && typeof error.code === 'string' && error.code.length > 0;

export const toggleReviewLike = async (
  reviewId: string,
  _legacyUserId?: string
): Promise<ToggleReviewLikeResult> => {
  try {
    // Voter identity is derived server-side from auth.uid().
    const { data, error } = await supabase.rpc('toggle_review_like', { p_review_id: reviewId });
    if (error) {
      return { success: false, error: error.message || 'Request failed', ambiguous: !isConfirmedRejection(error) };
    }
    if (typeof data !== 'boolean') {
      return { success: false, error: 'Unexpected response', ambiguous: true };
    }
    return { success: true, isLiked: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error', ambiguous: true };
  }
};

/** Authoritative read via the hardened RPCs. Throws on failure. */
export const fetchReviewHelpfulState = async (
  reviewIds: string[],
  viewerId: string | null
): Promise<Map<string, ReviewHelpfulState>> => {
  const out = new Map<string, ReviewHelpfulState>();
  if (reviewIds.length === 0) return out;
  const [countsRes, likedRes] = await Promise.all([
    supabase.rpc('get_review_likes_batch', { p_review_ids: reviewIds }),
    viewerId
      ? supabase.rpc('get_user_review_likes', { p_review_ids: reviewIds })
      : Promise.resolve({ data: [] as { review_id: string }[], error: null }),
  ]);
  if (countsRes.error) throw countsRes.error;
  if (likedRes.error) throw likedRes.error;
  const liked = new Set((likedRes.data || []).map((r) => r.review_id));
  const counts = new Map((countsRes.data || []).map((r) => [r.review_id, Number(r.like_count) || 0]));
  for (const id of reviewIds) {
    out.set(id, { count: counts.get(id) ?? 0, isLiked: viewerId ? liked.has(id) : null });
  }
  return out;
};
