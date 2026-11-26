import { supabase } from '@/integrations/supabase/client';

/**
 * Owner-only lookup for the signed-in author's PRIVATE review of an entity.
 * Kept separate from public entity collections so private rows never enter
 * public lists, counts or Circle data. The user_id filter plus RLS both bind
 * the result to the caller.
 */
export async function fetchUserEntityReview(entityId: string, userId: string, signal?: AbortSignal) {
  let q = supabase
    .from('reviews')
    .select('*')
    .eq('entity_id', entityId)
    .eq('user_id', userId)
    .eq('visibility', 'private')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(1);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw error;
  const row = data?.[0] ?? null;
  // Defence in depth: never return someone else's or a non-private row.
  if (!row || row.user_id !== userId || row.visibility !== 'private') return null;
  return row;
}
