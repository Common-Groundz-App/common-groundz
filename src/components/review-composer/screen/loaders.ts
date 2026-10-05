/**
 * Step 3B — server reads for the review page. Each returns a typed result so
 * the page can tell "not found" from "couldn't reach the server".
 */
import { supabase } from '@/integrations/supabase/client';
import type { EntityAdapter } from '@/components/profile/circles/types';
import type { MediaItem } from '@/types/media';
import { getParentEntity } from '@/services/entityHierarchyService';
import { getOfferingContextLine } from '@/services/entityRelationshipRegistry';
import { parseEntityTypeAtBoundary } from '@/services/entityType';
import type { ComposerSubject, StoredReviewRecord } from '../values';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string | null | undefined): v is string => !!v && UUID_RE.test(v);

export interface LoadedSubject {
  subject: ComposerSubject;
  display: EntityAdapter;
  contextLine: string | null;
}

export type SubjectLoad = { status: 'ok'; value: LoadedSubject } | { status: 'not_found' } | { status: 'error' };

const ENTITY_COLUMNS = 'id, name, type, venue, image_url, description, metadata, is_deleted';

/** Provider ("Dish at Toit") context for offerings; best-effort. */
export async function resolveProvider(subjectId: string, type: string | null) {
  const canonical = parseEntityTypeAtBoundary(type);
  if (!canonical) return { providerName: null, contextLine: null };
  try {
    const parent = await getParentEntity(subjectId);
    if (!parent?.name) return { providerName: null, contextLine: null };
    const ctx = getOfferingContextLine(parent.type as never, canonical);
    return {
      providerName: parent.name,
      contextLine: ctx ? `${ctx.singular} ${ctx.verb} ${parent.name}` : `Part of ${parent.name}`,
    };
  } catch {
    return { providerName: null, contextLine: null };
  }
}

export function toSubject(row: EntityAdapter, providerName: string | null): ComposerSubject {
  return {
    id: row.id,
    name: row.name,
    type: row.type ?? null,
    venue: row.venue ?? null,
    metadata: (row.metadata as ComposerSubject['metadata']) ?? null,
    providerName,
  };
}

function rowToAdapter(data: Record<string, any>): EntityAdapter {
  return {
    id: data.id,
    name: data.name,
    type: data.type,
    venue: data.venue ?? undefined,
    image_url: data.image_url ?? undefined,
    description: data.description ?? undefined,
    metadata: data.metadata ?? undefined,
  };
}

export async function loadSubject(entityId: string): Promise<SubjectLoad> {
  if (!isUuid(entityId)) return { status: 'not_found' };
  try {
    const { data, error } = await supabase.from('entities').select(ENTITY_COLUMNS).eq('id', entityId).maybeSingle();
    if (error) return { status: 'error' };
    if (!data || (data as any).is_deleted) return { status: 'not_found' };
    const display = rowToAdapter(data);
    const { providerName, contextLine } = await resolveProvider(display.id, display.type);
    return { status: 'ok', value: { subject: toSubject(display, providerName), display, contextLine } };
  } catch {
    return { status: 'error' };
  }
}

export interface LoadedReview {
  record: StoredReviewRecord;
  createdAt: string;
  display: EntityAdapter | null;
  contextLine: string | null;
}

export type ReviewLoad =
  | { status: 'ok'; value: LoadedReview }
  | { status: 'not_found' }
  | { status: 'unauthorized' }
  | { status: 'error' };

const REVIEW_COLUMNS =
  'id, user_id, entity_id, category, title, venue, subtitle, description, rating, media, image_url, visibility, experience_date, metadata, status, created_at';

/** Exact review for Edit. Ownership is checked against the signed-in user. */
export async function loadReviewForEdit(reviewId: string, currentUserId: string): Promise<ReviewLoad> {
  if (!isUuid(reviewId)) return { status: 'not_found' };
  try {
    const { data, error } = await supabase.from('reviews').select(REVIEW_COLUMNS).eq('id', reviewId).maybeSingle();
    if (error) return { status: 'error' };
    if (!data || (data as any).status === 'deleted') return { status: 'not_found' };
    if (data.user_id !== currentUserId) return { status: 'unauthorized' };
    let display: EntityAdapter | null = null;
    let subject: ComposerSubject | null = null;
    let contextLine: string | null = null;
    if (data.entity_id) {
      const s = await loadSubject(data.entity_id);
      if (s.status === 'error') return { status: 'error' };
      if (s.status === 'ok') {
        display = s.value.display;
        subject = s.value.subject;
        contextLine = s.value.contextLine;
      }
    }
    // Parity with the legacy popup: older reviews kept their own photo only in image_url.
    let media = (Array.isArray(data.media) ? (data.media as unknown as MediaItem[]) : []) ?? [];
    if (media.length === 0 && data.image_url) {
      media = [{ url: data.image_url, type: 'image', order: 0, id: 'legacy-image' } as MediaItem];
    }
    const record: StoredReviewRecord = {
      id: data.id,
      user_id: data.user_id,
      entity_id: data.entity_id,
      category: data.category,
      title: data.title,
      venue: data.venue,
      subtitle: data.subtitle,
      description: data.description,
      rating: data.rating,
      media,
      visibility: data.visibility as StoredReviewRecord['visibility'],
      experience_date: data.experience_date,
      metadata: data.metadata,
      status: data.status,
      entity: subject,
    };
    return { status: 'ok', value: { record, createdAt: data.created_at, display, contextLine } };
  } catch {
    return { status: 'error' };
  }
}

/** Plain reload used to compare an ambiguous edit. */
export async function reloadReviewRecord(reviewId: string): Promise<StoredReviewRecord | null> {
  const { data, error } = await supabase.from('reviews').select(REVIEW_COLUMNS).eq('id', reviewId).maybeSingle();
  if (error) throw error;
  return (data as unknown as StoredReviewRecord) ?? null;
}
