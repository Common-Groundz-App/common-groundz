import type { ContentType } from '@/contexts/ContentViewerContext';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Canonical route mapping for viewable content types.
 * `review` has no viewer surface, so it never produces a route.
 */
const CONTENT_ROUTE_BASE: Record<string, string> = {
  post: '/post',
  recommendation: '/recommendations',
};

export const isViewableContentType = (type: ContentType): boolean =>
  !!type && type in CONTENT_ROUTE_BASE;

/**
 * Builds the canonical in-app path for a piece of content.
 * Returns null for unsupported types or invalid ids so callers never push
 * a bogus URL (e.g. the legacy singular `/recommendation/:id`).
 *
 * Note: `focus=comment` is deliberately NEVER synthesized here — it means
 * "focus the comment composer", which would steal focus away from a
 * highlighted comment.
 */
export const buildContentPath = (
  type: ContentType,
  id: string | null,
  commentId?: string | null,
  opts?: { modal?: boolean }
): string | null => {
  if (!type || !id) return null;
  const base = CONTENT_ROUTE_BASE[type];
  if (!base) return null;

  const params = new URLSearchParams();
  if (commentId && UUID_RE.test(commentId)) params.set('commentId', commentId);
  if (opts?.modal) params.set('modal', 'true');

  const query = params.toString();
  return query ? `${base}/${id}?${query}` : `${base}/${id}`;
};
