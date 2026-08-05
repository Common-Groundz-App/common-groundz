import type { MediaItem } from '@/types/media';
import { isMuxItem, muxThumbnailUrl } from '@/utils/muxMedia';

/**
 * Phase 3.3A — pure resolution of the *target* media for a notification row.
 *
 * MUST stay pure: no supabase client, no react, no imageUtils (which pulls in
 * the storage client). Proxying is applied by the consumer, not here.
 *
 * Hard rules encoded below:
 *  - `notifications.image_url` is NEVER an input: it holds the ACTOR avatar.
 *  - a raw video file URL is never returned. `muxPosterUrl()` falls back to
 *    `thumbnail_url ?? url`, where `url` can be the video itself, so this module
 *    uses `muxThumbnailUrl(playback_id)` directly instead.
 *  - anything unparseable / non-http(s) resolves to `null`, and a `null` result
 *    means "render no thumbnail and no placeholder".
 */

export const THUMBNAIL_TARGET_TYPES = ['post', 'recommendation'] as const;
export type ThumbnailTargetType = (typeof THUMBNAIL_TARGET_TYPES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuidLike = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value.trim());

/** http(s) + parseable only. Rejects data:, blob:, relative and junk values. */
export const isRenderableImageUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/** A single media item -> a renderable still image URL, or null. */
export const resolveMediaItemThumbnail = (item: unknown): string | null => {
  if (!item || typeof item !== 'object') return null;
  const m = item as MediaItem;
  if (m.is_deleted) return null;

  // Mux video: only the deterministic image.mux.com thumbnail is safe.
  if (isMuxItem(m)) {
    if (m.mux_status === 'errored') return null;
    if (typeof m.mux_playback_id === 'string' && m.mux_playback_id.trim()) {
      return muxThumbnailUrl(m.mux_playback_id.trim(), { width: 160 });
    }
    // Ready-but-broken / still preparing without a poster: nothing to show.
    return isRenderableImageUrl(m.thumbnail_url) ? (m.thumbnail_url as string) : null;
  }

  if (m.type === 'video') {
    // Legacy (non-Mux) video qualifies ONLY via an explicit poster.
    return isRenderableImageUrl(m.thumbnail_url) ? (m.thumbnail_url as string) : null;
  }

  if (m.type === 'image') {
    if (isRenderableImageUrl(m.url)) return m.url;
    return isRenderableImageUrl(m.thumbnail_url) ? (m.thumbnail_url as string) : null;
  }

  return null;
};

/**
 * `posts.media` is jsonb and historically inconsistent (array, stringified
 * array, null, object). Every non-array shape resolves to null rather than
 * throwing.
 */
export const resolvePostThumbnail = (media: unknown): string | null => {
  let value = media;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;

  const ordered = [...value].sort((a, b) => {
    const oa = typeof (a as MediaItem)?.order === 'number' ? (a as MediaItem).order : 0;
    const ob = typeof (b as MediaItem)?.order === 'number' ? (b as MediaItem).order : 0;
    return oa - ob;
  });

  for (const item of ordered) {
    const resolved = resolveMediaItemThumbnail(item);
    if (resolved) return resolved;
  }
  return null;
};

export const resolveRecommendationThumbnail = (imageUrl: unknown): string | null =>
  isRenderableImageUrl(imageUrl) ? (imageUrl as string).trim() : null;

// ============================================================================
// Target collection / batching
// ============================================================================

export type NotificationTargetRef = {
  entityType: ThumbnailTargetType;
  entityId: string;
};

type TargetSource = {
  entity_type?: string | null;
  entity_id?: string | null;
};

/**
 * Eligibility is TARGET-based, not type-based: a comment, reply, mention or
 * comment-like still carries `entity_type='post'` + the parent `entity_id`
 * (metadata.comment_id only locates the comment inside it), so those rows get
 * the parent's preview exactly like a like does. Follow rows carry
 * `entity_type='profile'` and are therefore excluded automatically.
 */
export const getNotificationTargetRef = (
  row: TargetSource | null | undefined,
): NotificationTargetRef | null => {
  if (!row) return null;
  const type = typeof row.entity_type === 'string' ? row.entity_type.trim() : '';
  if (!THUMBNAIL_TARGET_TYPES.includes(type as ThumbnailTargetType)) return null;
  if (!isUuidLike(row.entity_id)) return null;
  return { entityType: type as ThumbnailTargetType, entityId: (row.entity_id as string).trim() };
};

/** Distinct, sorted ids per target type — sorted so cache keys are stable. */
export const collectTargetIds = (
  rows: ReadonlyArray<TargetSource | null | undefined>,
): Record<ThumbnailTargetType, string[]> => {
  const buckets: Record<ThumbnailTargetType, Set<string>> = {
    post: new Set(),
    recommendation: new Set(),
  };
  for (const row of rows) {
    const ref = getNotificationTargetRef(row);
    if (ref) buckets[ref.entityType].add(ref.entityId);
  }
  return {
    post: [...buckets.post].sort(),
    recommendation: [...buckets.recommendation].sort(),
  };
};

export const TARGET_CHUNK_SIZE = 200;

/** ceil(unique/200) bounded chunks. Empty input yields zero chunks (no query). */
export const chunkTargetIds = (
  ids: readonly string[],
  size: number = TARGET_CHUNK_SIZE,
): string[][] => {
  const limit = Math.max(1, size);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += limit) chunks.push(ids.slice(i, i + limit));
  return chunks;
};
