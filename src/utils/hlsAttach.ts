/**
 * Async-safe HLS attachment utility.
 *
 * Pure: zero imports from project code (no analytics, no types beyond hls.js).
 * Telemetry is injected via the optional `onEvent` callback.
 *
 * Lifecycle:
 *   const token: AttachToken = { cancelled: false };
 *   const detach = attachHls(video, src, token, { onEvent });
 *   // on cleanup:
 *   token.cancelled = true;
 *   detach();
 *
 * - Native HLS browsers (Safari/iOS): sets video.src directly, never imports hls.js.
 * - Other browsers: dynamic import('hls.js'), bails out if `token.cancelled`
 *   becomes true post-await (prevents stale attach to unmounted <video>).
 * - Cleanup removes the source attribute + calls .load() to prevent stale
 *   source bleeding into a React-reused <video> node.
 */

export type AttachToken = { cancelled: boolean };
export type HlsTelemetry = (event: string, props: Record<string, unknown>) => void;
export type HlsUnrecoverableReason = 'hls_unsupported' | 'hls_fatal' | 'hls_load_failed';
export interface AttachHlsOptions {
  onEvent?: HlsTelemetry;
  onUnrecoverable?: (reason: HlsUnrecoverableReason, detail?: unknown) => void;
}


const detachNative = (video: HTMLVideoElement) => {
  try {
    video.removeAttribute('src');
    video.load();
  } catch {
    /* ignore */
  }
};

export function attachHls(
  video: HTMLVideoElement,
  src: string,
  token: AttachToken,
  opts: AttachHlsOptions = {},
): () => void {
  const emit = opts.onEvent ?? (() => {});
  const onUnrecoverable = opts.onUnrecoverable ?? (() => {});

  // Native HLS path (Safari, iOS) — no hls.js download.
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    if (token.cancelled) return () => {};
    try {
      video.src = src;
    } catch {
      /* ignore */
    }
    return () => detachNative(video);
  }

  // MSE path — lazy load hls.js.
  let hls: import('hls.js').default | null = null;

  import('hls.js')
    .then(({ default: Hls }) => {
      if (token.cancelled) return;
      if (!Hls.isSupported()) {
        // No MSE and no native HLS — surface as unrecoverable. Do NOT assign
        // raw .m3u8 to <video>; Chromium can't play it and would report a
        // misleading "format unsupported" error.
        if (!token.cancelled) onUnrecoverable('hls_unsupported');
        return;
      }
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
      });
      if (import.meta.env.DEV) {
        const w = window as unknown as { __muxHlsLive?: number };
        w.__muxHlsLive = (w.__muxHlsLive ?? 0) + 1;
      }
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data?.fatal) return;
        emit('mux_hls_fatal', { src, type: data.type });
        try { hls?.destroy(); } catch { /* ignore */ }
        if (import.meta.env.DEV) {
          const w = window as unknown as { __muxHlsLive?: number };
          if (typeof w.__muxHlsLive === 'number') w.__muxHlsLive--;
        }
        hls = null;
        if (!token.cancelled) onUnrecoverable('hls_fatal', data.type);
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    })
    .catch((err) => {
      emit('mux_hls_load_failed', { src, err: String(err) });
      if (!token.cancelled) onUnrecoverable('hls_load_failed', String(err));
    });


  return () => {
    try { hls?.destroy(); } catch { /* ignore */ }
    if (hls && import.meta.env.DEV) {
      const w = window as unknown as { __muxHlsLive?: number };
      if (typeof w.__muxHlsLive === 'number') w.__muxHlsLive--;
    }
    hls = null;
    detachNative(video);
  };
}
