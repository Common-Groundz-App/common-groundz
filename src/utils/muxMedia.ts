import type { MediaItem } from '@/types/media';

/**
 * Phase 2A helpers for guarding video renderers against Mux MediaItems
 * that have not finished processing yet.
 *
 * Until Phase 2B ships the upload routing, no MediaItem in the wild will
 * have `provider === 'mux'`. These helpers are intentionally dead-safe
 * for legacy Supabase items (returning false).
 */

export const isMuxItem = (m: Pick<MediaItem, 'provider'> | null | undefined): boolean =>
  !!m && m.provider === 'mux';

/**
 * True when a Mux-backed video is not yet playable. Render the poster +
 * a "Processing" badge instead of mounting a <video> element.
 *
 * Note: an unknown status (mux_status undefined) is treated as preparing —
 * we'd rather show the poster than mount a broken player.
 */
export const isMuxPreparing = (
  m: Pick<MediaItem, 'provider' | 'mux_status'> | null | undefined,
): boolean => !!m && m.provider === 'mux' && m.mux_status !== 'ready';

export const isMuxErrored = (
  m: Pick<MediaItem, 'provider' | 'mux_status'> | null | undefined,
): boolean => !!m && m.provider === 'mux' && m.mux_status === 'errored';

/** Poster URL to use while a Mux video is preparing. */
export const muxPosterUrl = (m: MediaItem): string | undefined =>
  m.thumbnail_url ?? m.url;
