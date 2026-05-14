/**
 * Extract a stable storage path from a media URL.
 * - Strips protocol/host and query/hash.
 * - Strips Supabase Storage prefix `storage/v1/object/{public,sign}/<bucket>/`
 *   so we store only the bucket-relative path (the dedupe key).
 * - PRESERVES original casing (Supabase Storage paths are case-sensitive).
 * - Falls back to the raw input (sans query/hash) if URL parsing fails.
 *
 * Used as the dedupe key in `media_views`.
 */
export function extractMediaPath(input: string | undefined | null): string {
  if (!input) return '';
  let path: string;
  try {
    const u = new URL(input);
    path = u.pathname;
  } catch {
    path = input.split('?')[0].split('#')[0];
  }
  path = path.replace(/^\/+/, '');
  // Strip Supabase Storage prefix (public or signed URLs)
  path = path.replace(/^storage\/v1\/object\/(public|sign)\/[^/]+\//, '');
  return path;
}
