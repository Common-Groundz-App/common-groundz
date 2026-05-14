/**
 * Extract a stable storage path from a media URL.
 * - Strips protocol/host and query/hash.
 * - PRESERVES original casing (Supabase Storage paths are case-sensitive).
 * - Falls back to the raw input (sans query/hash) if URL parsing fails.
 *
 * Used as the dedupe key in `media_views`.
 */
export function extractMediaPath(input: string | undefined | null): string {
  if (!input) return '';
  try {
    const u = new URL(input);
    return u.pathname.replace(/^\/+/, '');
  } catch {
    return input.split('?')[0].split('#')[0].replace(/^\/+/, '');
  }
}
