/**
 * Returns true only for hosts known to serve media bytes with
 * `Access-Control-Allow-Origin: *`, so a <video crossOrigin="anonymous">
 * still loads AND a subsequent canvas read stays untainted.
 *
 * Anything else returns false — the caller MUST omit the crossOrigin
 * attribute entirely for unknown hosts. (Setting it on a non-CORS host
 * can break playback; toggling it later forces a reload.)
 *
 * Known-safe:
 *   - stream.mux.com (Mux HLS)
 *   - the configured Supabase host (from VITE_SUPABASE_URL)
 *   - any *.supabase.co / *.supabase.in subdomain — covers Supabase-owned
 *     subdomains only (Storage, transformation CDN, project hosts).
 *     Custom/proxied domains pointed at Supabase are NOT matched — add
 *     them explicitly here if/when introduced.
 */
const configuredSupabaseHost: string = (() => {
  try {
    const raw = (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
    if (!raw) return '';
    return new URL(raw).host;
  } catch {
    return '';
  }
})();

export function isCorsSafeVideoHost(src: string | undefined | null): boolean {
  if (!src) return false;
  try {
    const h = new URL(src, typeof window !== 'undefined' ? window.location.href : 'http://localhost').host;
    if (h === 'stream.mux.com') return true;
    if (configuredSupabaseHost && h === configuredSupabaseHost) return true;
    if (h.endsWith('.supabase.co') || h.endsWith('.supabase.in')) return true;
    return false;
  } catch {
    return false;
  }
}
