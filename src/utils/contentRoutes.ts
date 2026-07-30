const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Content types that have a real page in the app's route table.
 * Reviews have no page, so they are deliberately absent here.
 */
export type RoutableContentType = 'post' | 'recommendation';

const CONTENT_ROUTE_BASE: Record<RoutableContentType, string> = {
  post: '/post',
  recommendation: '/recommendations',
};

export const isRoutableContentType = (
  type: unknown
): type is RoutableContentType =>
  type === 'post' || type === 'recommendation';

/**
 * Builds the canonical in-app path for a piece of content.
 * Returns null for unsupported types or missing ids so callers never push
 * a bogus URL (e.g. the legacy singular `/recommendation/:id`).
 *
 * Note: `focus=comment` is deliberately NEVER synthesized here — it means
 * "focus the comment composer", which would steal focus away from a
 * highlighted comment.
 */
export const buildContentPath = (
  type: RoutableContentType,
  id: string | null,
  commentId?: string | null
): string | null => {
  if (!isRoutableContentType(type) || !id) return null;
  const base = CONTENT_ROUTE_BASE[type];

  const params = new URLSearchParams();
  if (commentId && UUID_RE.test(commentId)) params.set('commentId', commentId);

  const query = params.toString();
  return query ? `${base}/${id}?${query}` : `${base}/${id}`;
};
