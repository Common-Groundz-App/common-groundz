import type { MediaItem } from '@/types/media';

export const MUX_UNAVAILABLE_TITLE = 'Video no longer available';
export const MUX_UNAVAILABLE_COPY = 'This video upload is no longer available. Remove it or upload the video again to publish.';

/** Only the attachment barrier's known signal/detail, never SQLSTATE alone. */
export function isMuxVideoUnavailable(error: unknown): boolean {
  const seen = new Set<object>();
  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    const row = value as Record<string, unknown>;
    const known = (text: unknown) => typeof text === 'string' &&
      (/(^|[^a-zA-Z0-9_])video_unavailable($|[^a-zA-Z0-9_])/.test(text) || text.trim() === 'mux asset has been removed');
    return known(row.message) || known(row.details) || known(row.detail) || visit(row.cause);
  };
  return visit(error);
}

/** The composers allow one video; the barrier reports no upload ID. */
export function rejectedMuxUploadIds(media: readonly MediaItem[]): string[] {
  return media.filter((m) => m.type === 'video' && m.provider === 'mux' && !!m.mux_upload_id)
    .map((m) => m.mux_upload_id as string);
}