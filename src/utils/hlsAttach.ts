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

// Diagnostic gate: DEV always on; on published/preview, opt-in via ?hlsdebug=1.
const HLS_DEBUG: boolean = (() => {
  try {
    if (import.meta.env.DEV) return true;
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('hlsdebug') === '1';
  } catch {
    return false;
  }
})();


const getDefaultEstimate = (): number => {
  try {
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!conn) return 2_500_000;
    if (conn.saveData) return 500_000;
    const et = conn.effectiveType;
    if (et === 'slow-2g' || et === '2g') return 500_000;
    return 2_500_000;
  } catch {
    return 2_500_000;
  }
};

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

  // TEMP proof-of-execution log. Uses console.log (not debug) so it survives
  // production builds and default DevTools log-level filtering.
  try {
    console.log('[hls][debug_gate] attachHls called', {
      href: typeof window !== 'undefined' ? window.location.href : '(no window)',
      search: typeof window !== 'undefined' ? window.location.search : '(no window)',
      HLS_DEBUG,
      src,
      canPlayNativeHls: !!video.canPlayType('application/vnd.apple.mpegurl'),
    });
  } catch { /* ignore */ }

  // Native HLS path (Safari, iOS) — no hls.js download.
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    try { console.log('[hls][debug_gate] path=native'); } catch { /* ignore */ }
    if (token.cancelled) return () => {};
    try {
      video.src = src;
    } catch {
      /* ignore */
    }
    return () => detachNative(video);
  }

  try { console.log('[hls][debug_gate] path=mse, importing hls.js'); } catch { /* ignore */ }

  // MSE path — lazy load hls.js.
  let hls: import('hls.js').default | null = null;

  import('hls.js')
    .then(({ default: Hls }) => {
      try { console.log('[hls][debug_gate] hls.js loaded', { isSupported: Hls.isSupported() }); } catch { /* ignore */ }
      if (token.cancelled) {
        try { console.log('[hls][debug_gate] cancelled before attach'); } catch { /* ignore */ }
        return;
      }
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
        capLevelToPlayerSize: true,
        abrEwmaDefaultEstimate: getDefaultEstimate(),
      });
      if (HLS_DEBUG) {
        const w = window as unknown as { __muxHlsLive?: number };
        w.__muxHlsLive = (w.__muxHlsLive ?? 0) + 1;

        // Diagnostic-only logging (DEV). No behavior change.
        try {
          const cfg = (hls as unknown as { config?: Record<string, unknown> }).config ?? {};
          console.debug('[hls][construct]', {
            src,
            abrEwmaDefaultEstimate: cfg.abrEwmaDefaultEstimate,
            capLevelToPlayerSize: cfg.capLevelToPlayerSize,
            testBandwidth: cfg.testBandwidth,
            clientWidth: video.clientWidth,
            clientHeight: video.clientHeight,
            devicePixelRatio: window.devicePixelRatio,
          });
        } catch { /* ignore */ }

        let fragCount = 0;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          try {
            const levels = (data?.levels ?? []).map((lv: { width?: number; height?: number; bitrate?: number }, i: number) => ({
              index: i,
              resolution: `${lv.width ?? '?'}x${lv.height ?? '?'}`,
              bitrate: lv.bitrate,
            }));
            console.debug('[hls][manifest_parsed]', { src, levels });
          } catch { /* ignore */ }
        });
        hls.on(Hls.Events.LEVEL_SWITCHING, (_e, data) => {
          try {
            const lv = hls?.levels?.[data.level];
            console.debug('[hls][level_switching]', {
              level: data.level,
              resolution: lv ? `${lv.width}x${lv.height}` : undefined,
              bitrate: lv?.bitrate,
            });
          } catch { /* ignore */ }
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          try {
            const lv = hls?.levels?.[data.level];
            console.debug('[hls][level_switched]', {
              level: data.level,
              resolution: lv ? `${lv.width}x${lv.height}` : undefined,
              bitrate: lv?.bitrate,
            });
          } catch { /* ignore */ }
        });
        hls.on(Hls.Events.FRAG_LOADED, (_e, data) => {
          if (fragCount >= 5) return;
          fragCount++;
          try {
            const frag = data?.frag as { sn?: number | string; level?: number } | undefined;
            const lv = frag && typeof frag.level === 'number' ? hls?.levels?.[frag.level] : undefined;
            const stats = (data as unknown as { stats?: { loading?: { start?: number; end?: number } } })?.stats;
            const loadMs = stats?.loading?.start != null && stats?.loading?.end != null
              ? stats.loading.end - stats.loading.start
              : undefined;
            console.debug('[hls][frag_loaded]', {
              n: fragCount,
              sn: frag?.sn,
              level: frag?.level,
              resolution: lv ? `${lv.width}x${lv.height}` : undefined,
              bitrate: lv?.bitrate,
              loadMs,
            });
          } catch { /* ignore */ }
        });
      }
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data?.fatal) return;
        emit('mux_hls_fatal', { src, type: data.type });
        try { hls?.destroy(); } catch { /* ignore */ }
        if (HLS_DEBUG) {
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
    if (hls && HLS_DEBUG) {
      const w = window as unknown as { __muxHlsLive?: number };
      if (typeof w.__muxHlsLive === 'number') w.__muxHlsLive--;
    }
    hls = null;
    detachNative(video);
  };
}
