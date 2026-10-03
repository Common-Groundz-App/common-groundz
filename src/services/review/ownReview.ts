import { supabase } from '@/integrations/supabase/client';
import { getEntityUrl, getHierarchicalEntityUrl } from '@/utils/entityUrlUtils';

/**
 * Review Lifecycle Step 1 — the single definition of "have I already reviewed
 * this subject?". The owner always comes from the signed-in session, never
 * from a caller-supplied id. Not filtered by visibility: RLS lets an owner read
 * all of their own reviews (public, circle_only, private).
 *
 * A failed lookup is `error`, never `none` — callers must block creation.
 */
export interface OwnReviewSummary {
  id: string;
  entity_id: string;
  user_id: string;
  title: string;
  rating: number;
  visibility: string;
  has_timeline: boolean | null;
  timeline_count: number | null;
}

export type OwnReviewLookup =
  | { status: 'found'; review: OwnReviewSummary; canonicalPath: string | null }
  | { status: 'none' }
  | { status: 'error' };

export const REVIEW_UNIQUE_CONSTRAINT = 'reviews_one_per_user_entity';

export async function findOwnReviewForEntity(
  entityId: string,
  options: { excludeReviewId?: string } = {},
): Promise<OwnReviewLookup> {
  if (!entityId) return { status: 'error' };
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const ownerId = sessionData?.session?.user?.id;
    if (sessionError || !ownerId) return { status: 'error' };

    let query = supabase
      .from('reviews')
      .select('id, entity_id, user_id, title, rating, visibility, has_timeline, timeline_count')
      .eq('user_id', ownerId)
      .eq('entity_id', entityId);
    if (options.excludeReviewId) query = query.neq('id', options.excludeReviewId);

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) return { status: 'error' };
    if (!data) return { status: 'none' };
    // Routing is best-effort: a failed slug read must not turn a known owned
    // review into "none" or permit another review to be created.
    let canonicalPath: string | null = null;
    try {
      const { data: entity, error: entityError } = await supabase
        .from('entities')
        .select('id, slug, parent_id')
        .eq('id', entityId)
        .eq('is_deleted', false)
        .maybeSingle();
      if (!entityError && entity?.slug) {
        if (entity.parent_id) {
          const { data: parent, error: parentError } = await supabase
            .from('entities')
            .select('id, slug')
            .eq('id', entity.parent_id)
            .eq('is_deleted', false)
            .maybeSingle();
          if (!parentError && parent?.slug) canonicalPath = getHierarchicalEntityUrl(parent, entity);
        } else {
          canonicalPath = getEntityUrl(entity);
        }
      }
    } catch {
      // The button can retry the route lookup without losing the owned review.
    }
    return { status: 'found', review: data as OwnReviewSummary, canonicalPath };
  } catch {
    return { status: 'error' };
  }
}

/** True only for a unique violation raised by the one-review-per-subject rule. */
export function isOwnReviewUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; details?: string };
  if (e.code !== '23505') return false;
  const text = `${e.message ?? ''} ${e.details ?? ''}`;
  return text.includes(REVIEW_UNIQUE_CONSTRAINT);
}
