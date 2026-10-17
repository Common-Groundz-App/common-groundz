// Phase 5 — canonical identity for Review / Timeline-Update video views.
// Pure helpers (no I/O) so they can be unit-tested.

export interface PersistedMedia {
  id?: string;
  type?: string;
  url?: string;
  provider?: string;
  mux_status?: string;
  mux_playback_id?: string;
}

/** Canonical dedupe identity from a persisted media record, or null if not a ready video. */
export function canonicalVideoIdentity(m: PersistedMedia | null | undefined): string | null {
  if (!m || m.type !== 'video') return null;
  if (m.provider === 'mux') {
    if (m.mux_status !== 'ready' || !m.mux_playback_id) return null;
    return `mux:${m.mux_playback_id}`;
  }
  if (!m.url) return null;
  try {
    const p = new URL(m.url).pathname.replace(/^\/+/, '');
    const match = p.match(/^storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return `storage:${match[1]}/${match[2]}`;
  } catch {
    return null;
  }
}

function clientIdentityHints(mediaPath: string): string[] {
  const hints = [mediaPath];
  const mux = mediaPath.match(/stream\.mux\.com\/([^/.?#]+)/);
  if (mux) hints.push(`mux:${mux[1]}`);
  try {
    const p = new URL(mediaPath).pathname.replace(/^\/+/, '');
    const s = p.match(/^storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (s) hints.push(`storage:${s[1]}/${s[2]}`);
  } catch { /* not a URL */ }
  return hints;
}

/**
 * Match client-submitted media to the persisted list. Prefers the stable
 * media id; otherwise matches by derived identity. Returns the canonical
 * identity from the PERSISTED record, or null (unknown / not a ready video).
 */
export function resolveReviewVideo(
  media: unknown,
  mediaId: string | undefined,
  mediaPath: string,
): string | null {
  if (!Array.isArray(media)) return null;
  const items = media as PersistedMedia[];
  if (mediaId) {
    const byId = items.find((m) => m?.id === mediaId);
    return byId ? canonicalVideoIdentity(byId) : null;
  }
  const hints = clientIdentityHints(mediaPath);
  for (const m of items) {
    const c = canonicalVideoIdentity(m);
    if (c && hints.includes(c)) return c;
  }
  return null;
}
