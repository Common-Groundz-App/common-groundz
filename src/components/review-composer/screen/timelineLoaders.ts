/**
 * Step 3C — server reads for the timeline-update routes.
 *
 * Each check has its own result so the page never collapses "a newer update
 * exists" or "couldn't reach the server" into "not found". The one-hour rule
 * is server-owned: the device clock only produces the advisory `mayBeExpired`
 * flag and never blocks the form.
 */
import { supabase } from '@/integrations/supabase/client';
import type { MediaItem } from '@/types/media';
import { isWithinEditWindow } from '@/utils/reviewEditPolicy';
import type { StoredTimelineUpdateRecord } from '../values';
import { isUuid } from './loaders';

const UPDATE_COLUMNS = 'id, review_id, user_id, rating, comment, media, would_recommend, created_at, updated_at';

export type UpdateLoad =
  | { status: 'ok'; value: StoredTimelineUpdateRecord; mayBeExpired: boolean }
  | { status: 'not_found' }
  | { status: 'unauthorized' }
  | { status: 'wrong_review' }
  | { status: 'not_latest' }
  | { status: 'error' };

function toRecord(row: Record<string, any>): StoredTimelineUpdateRecord {
  const w = row.would_recommend;
  return {
    id: row.id,
    review_id: row.review_id,
    user_id: row.user_id,
    rating: row.rating ?? null,
    comment: row.comment ?? '',
    media: Array.isArray(row.media) ? (row.media as MediaItem[]) : [],
    would_recommend: w === 'yes' || w === 'maybe' || w === 'no' || w === 'auto' ? w : null,
    created_at: row.created_at,
  };
}

/** Exact update by id (throws on a network/permission error). */
export async function loadUpdateById(reviewId: string, updateId: string): Promise<StoredTimelineUpdateRecord | null> {
  const { data, error } = await supabase.from('review_updates').select(UPDATE_COLUMNS).eq('id', updateId).maybeSingle();
  if (error) throw error;
  if (!data || data.review_id !== reviewId) return null;
  return toRecord(data);
}

/** Newest update, same order as the timeline list and the edit function. */
export async function loadLatestUpdate(reviewId: string): Promise<StoredTimelineUpdateRecord | null> {
  const { data, error } = await supabase
    .from('review_updates')
    .select(UPDATE_COLUMNS)
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data) : null;
}

/** Ownership of the review is checked by the review loader first. */
export async function loadUpdateForEdit(
  reviewId: string,
  updateId: string,
  currentUserId: string,
  now: number = Date.now(),
): Promise<UpdateLoad> {
  if (!isUuid(reviewId) || !isUuid(updateId)) return { status: 'not_found' };
  try {
    const { data, error } = await supabase.from('review_updates').select(UPDATE_COLUMNS).eq('id', updateId).maybeSingle();
    if (error) return { status: 'error' };
    if (!data) return { status: 'not_found' };
    if (data.review_id !== reviewId) return { status: 'wrong_review' };
    if (data.user_id !== currentUserId) return { status: 'unauthorized' };
    let latest: StoredTimelineUpdateRecord | null;
    try {
      latest = await loadLatestUpdate(reviewId);
    } catch {
      return { status: 'error' };
    }
    if (!latest || latest.id !== updateId) return { status: 'not_latest' };
    return { status: 'ok', value: toRecord(data), mayBeExpired: !isWithinEditWindow(data.created_at, now) };
  } catch {
    return { status: 'error' };
  }
}
