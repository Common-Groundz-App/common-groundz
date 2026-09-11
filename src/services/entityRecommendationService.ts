import { supabase } from '@/integrations/supabase/client';

export interface EntityRecommenderWithContext {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_following: boolean;
  is_mutual: boolean;
  recommended_at: string;
  rating: number;
  latest_rating: number | null;
  effective_rating: number;
}

/**
 * Phase 4.2A: canonical selection, endorsement filtering, search, relationship
 * filtering, ordering and pagination all happen in SQL (`get_entity_recommenders`).
 *
 * Frozen semantics of that RPC:
 *  - public + published reviews only (visibility filter before canonical selection)
 *  - one canonical review per person: `created_at DESC NULLS LAST, id DESC`
 *  - a person appears only when their canonical review has `is_recommended = true`
 *  - deterministic order: following, then mutual, then recency, then user id
 *
 * `currentUserId` is retained for interface compatibility; the RPC derives the
 * viewer from the session (`auth.uid()`) so relationship flags cannot be spoofed.
 */
export const getEntityRecommendersWithContext = async (
  entityId: string,
  currentUserId: string | null,
  options: {
    search?: string;
    relationshipFilter?: 'all' | 'following' | 'mutual';
    limit?: number;
    offset?: number;
  } = {}
): Promise<EntityRecommenderWithContext[]> => {
  const { search, relationshipFilter = 'all', limit = 50, offset = 0 } = options;

  const { data, error } = await supabase.rpc('get_entity_recommenders', {
    p_entity_id: entityId,
    p_search: search?.trim() ? search.trim() : null,
    p_relationship: relationshipFilter,
    p_limit: limit,
    p_offset: offset
  });

  if (error) {
    console.error('Error fetching entity recommenders:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    username: row.username,
    first_name: row.first_name,
    last_name: row.last_name,
    avatar_url: row.avatar_url,
    is_following: Boolean(row.is_following),
    is_mutual: Boolean(row.is_mutual),
    recommended_at: row.recommended_at,
    rating: Number(row.rating),
    latest_rating: row.latest_rating === null ? null : Number(row.latest_rating),
    effective_rating: Number(row.effective_rating)
  }));
};
