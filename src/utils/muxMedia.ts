import type { MediaItem } from '@/types/media';

/**
 * Phase 2A + Phase 4 helpers for Mux MediaItems.
 *
 * IMPORTANT: This module MUST stay a pure utility with zero project-internal
 * imports beyond types. Telemetry is injected via callbacks (see
 * maybeEmitBrokenReady) to avoid import cycles with analytics/services.
 */

// ============================================================================
// State predicates
// ============================================================================

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
): boolean => !!m && m.provider === 'mux' && m.mux_status !== 'ready' && m.mux_status !== 'errored';

export const isMuxErrored = (
  m: Pick<MediaItem, 'provider' | 'mux_status'> | null | undefined,
): boolean => !!m && m.provider === 'mux' && m.mux_status === 'errored';

/** Mux says ready but the row is missing playback_id — treat as errored UI. */
export const isMuxReadyButBroken = (
  m: Pick<MediaItem, 'provider' | 'mux_status' | 'mux_playback_id'> | null | undefined,
): boolean =>
  !!m && m.provider === 'mux' && m.mux_status === 'ready' && !m.mux_playback_id;

/** The ONE predicate every renderer checks for the "errored poster" branch. */
export const isMuxErroredOrBroken = (
  m: Pick<MediaItem, 'provider' | 'mux_status' | 'mux_playback_id'> | null | undefined,
): boolean => isMuxErrored(m) || isMuxReadyButBroken(m);

/** Mux is ready AND we have a playback id — safe to mount <video> + HLS. */
export const isMuxPlayable = (
  m: Pick<MediaItem, 'provider' | 'mux_status' | 'mux_playback_id'> | null | undefined,
): boolean =>
  !!m && m.provider === 'mux' && m.mux_status === 'ready' && !!m.mux_playback_id;

// ============================================================================
// URL helpers
// ============================================================================

export const muxHlsUrl = (playbackId: string): string =>
  `https://stream.mux.com/${playbackId}.m3u8`;

export const muxThumbnailUrl = (playbackId: string, opts?: { time?: number; width?: number }): string => {
  const params = new URLSearchParams();
  if (opts?.time != null) params.set('time', String(opts.time));
  if (opts?.width != null) params.set('width', String(opts.width));
  const qs = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${qs ? `?${qs}` : ''}`;
};

/** Poster URL: prefer Mux thumbnail when playback_id present, else fall back. */
export const muxPosterUrl = (m: MediaItem): string | undefined => {
  if (isMuxItem(m) && m.mux_playback_id) {
    return muxThumbnailUrl(m.mux_playback_id);
  }
  return m.thumbnail_url ?? m.url;
};

/**
 * Resolve which src + transport to use for a video MediaItem.
 * - Mux + playable → HLS .m3u8 from playback_id
 * - Legacy → item.url, no HLS
 */
export const resolveVideoSrc = (
  m: MediaItem,
): { src: string | undefined; isHls: boolean } => {
  if (isMuxPlayable(m) && m.mux_playback_id) {
    return { src: muxHlsUrl(m.mux_playback_id), isHls: true };
  }
  return { src: m.url, isHls: false };
};

// ============================================================================
// One-shot telemetry for ready-but-broken state (dependency-free)
// ============================================================================

type EmitFn = (event: string, props: Record<string, unknown>) => void;

const _brokenReadyEmitted = new Set<string>();

/**
 * Fire `mux_ready_without_playback_id` exactly once per asset per session.
 * The dedup Set lives here so all callers share it; analytics is injected
 * by the caller so this module stays a pure utility with no import cycles.
 */
export const maybeEmitBrokenReady = (m: MediaItem, onEvent: EmitFn): void => {
  const key = m.mux_asset_id ?? m.id ?? m.url;
  if (!key || _brokenReadyEmitted.has(key)) return;
  _brokenReadyEmitted.add(key);
  onEvent('mux_ready_without_playback_id', {
    asset_id: m.mux_asset_id,
    playback_id: m.mux_playback_id ?? null,
  });
};
