import { muxHlsUrl } from '@/utils/muxMedia';

/**
 * Tier 2 — Time-aware Mux HLS prewarm.
 *
 * Fire-and-forget. Best-effort. Never throws.
 *
 * On tap, primes the browser HTTP cache with the master playlist, the first
 * media playlist, and the segment whose playback range covers `currentTime`.
 * When the lightbox subsequently attaches hls.js (or native HLS on Safari),
 * those requests come from cache and `loadeddata` arrives faster.
 *
 * Safety:
 * - Success-gated dedup: a key is added to `_warmed*` ONLY after a 2xx
 *   response. Concurrent re-taps for the same key dedupe via `_inFlight*`.
 *   Failure/abort never marks warmed, so retries work on the next tap.
 * - Honors `navigator.connection.saveData` — skips entirely when Data Saver
 *   is on. The browser/OS already exposes this user preference.
 * - 4s overall AbortController; also aborts on `visibilitychange → hidden`.
 * - No new state, no hidden <video>, no Hls instantiation here.
 */

let _prewarmEnabled = true;

/**
 * Runtime kill switch — disables prewarm without touching call sites.
 *
 * NOTE: `_prewarmEnabled` itself is a code constant default, so flipping the
 * default still requires rebuild/redeploy. For true runtime control, call
 * `setPrewarmEnabled(false)` from a React effect that reads an app_config
 * flag. The wiring to a DB-backed flag is intentionally not included in
 * Tier 2 — only the mechanism ships here.
 */
export const setPrewarmEnabled = (enabled: boolean): void => {
  _prewarmEnabled = enabled;
};

const SEGMENT_BUCKET_SECONDS = 10;
const PREWARM_TIMEOUT_MS = 4000;

// Success-gated dedup. `_inFlight*` is set when a request starts and removed
// on completion (success or failure). `_warmed*` is set ONLY after a 2xx —
// so a failed/aborted prewarm never blocks a future retry.
const _inFlightMaster = new Set<string>();
const _warmedMaster = new Set<string>();
const _inFlightMedia = new Set<string>();
const _warmedMedia = new Set<string>();
const _inFlightSegments = new Set<string>();
const _warmedSegments = new Set<string>();

const isSaveDataOn = (): boolean => {
  try {
    return Boolean((navigator as unknown as { connection?: { saveData?: boolean } })?.connection?.saveData);
  } catch {
    return false;
  }
};

const fetchOpts = (signal: AbortSignal): RequestInit => ({
  method: 'GET',
  mode: 'cors',
  credentials: 'omit',
  cache: 'default',
  signal,
});

function firstResourceLine(text: string): string | null {
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (l.length > 0 && !l.startsWith('#')) return l;
  }
  return null;
}

function pickSegmentAt(text: string, targetTime: number): string | null {
  const lines = text.split('\n').map((l) => l.trim());
  let cumulative = 0;
  let pendingDur = 0;
  let lastSegment: string | null = null;
  for (const l of lines) {
    if (l.startsWith('#EXTINF:')) {
      const m = l.match(/^#EXTINF:([\d.]+)/);
      pendingDur = m ? parseFloat(m[1]) : 0;
    } else if (l.length > 0 && !l.startsWith('#')) {
      lastSegment = l;
      if (cumulative + pendingDur >= targetTime) return lastSegment;
      cumulative += pendingDur;
      pendingDur = 0;
    }
  }
  return lastSegment;
}

export function prewarmMuxHls(
  playbackId: string | null | undefined,
  currentTime: number = 0,
): void {
  if (!_prewarmEnabled || !playbackId) return;
  if (isSaveDataOn()) return;

  // Harmless on Safari/iOS — module loads but is never instantiated there.
  try {
    void import('hls.js');
  } catch {
    /* ignore */
  }

  const target = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  const segmentKey = `${playbackId}@${Math.floor(target / SEGMENT_BUCKET_SECONDS)}`;

  const needMaster = !_warmedMaster.has(playbackId) && !_inFlightMaster.has(playbackId);
  const needMedia = !_warmedMedia.has(playbackId) && !_inFlightMedia.has(playbackId);
  const needSegment = !_warmedSegments.has(segmentKey) && !_inFlightSegments.has(segmentKey);
  if (!needMaster && !needMedia && !needSegment) return;

  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), PREWARM_TIMEOUT_MS);
  const onHide = () => {
    if (document.visibilityState === 'hidden') ac.abort();
  };
  document.addEventListener('visibilitychange', onHide);
  const cleanup = () => {
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onHide);
  };

  if (needMaster) _inFlightMaster.add(playbackId);
  if (needMedia) _inFlightMedia.add(playbackId);
  if (needSegment) _inFlightSegments.add(segmentKey);

  const masterUrl = muxHlsUrl(playbackId);

  (async () => {
    let masterText: string | null = null;
    let mediaUrl: string | null = null;

    try {
      // ---- Master playlist ----
      const r1 = await fetch(masterUrl, fetchOpts(ac.signal));
      if (!r1.ok) return;
      masterText = await r1.text();
      if (needMaster) {
        _inFlightMaster.delete(playbackId);
        _warmedMaster.add(playbackId);
      }

      const childRel = firstResourceLine(masterText);
      if (!childRel) return;
      const childUrl = new URL(childRel, masterUrl).toString();

      // Single-rendition edge case: master is actually a media playlist and
      // the first non-comment line is a segment, not a child .m3u8.
      if (!childUrl.endsWith('.m3u8')) {
        if (needSegment) {
          const rs = await fetch(childUrl, fetchOpts(ac.signal));
          if (rs.ok) {
            _inFlightSegments.delete(segmentKey);
            _warmedSegments.add(segmentKey);
          }
        }
        return;
      }

      mediaUrl = childUrl;

      // ---- Media playlist ----
      let mediaText: string | null = null;
      if (needMedia || needSegment) {
        const r2 = await fetch(mediaUrl, fetchOpts(ac.signal));
        if (!r2.ok) return;
        mediaText = await r2.text();
        if (needMedia) {
          _inFlightMedia.delete(playbackId);
          _warmedMedia.add(playbackId);
        }
      }

      // ---- Segment at currentTime (fallback: first segment) ----
      if (needSegment && mediaText) {
        const segRel = pickSegmentAt(mediaText, target) ?? firstResourceLine(mediaText);
        if (!segRel) return;
        const segUrl = new URL(segRel, mediaUrl).toString();
        const r3 = await fetch(segUrl, fetchOpts(ac.signal));
        if (r3.ok) {
          _inFlightSegments.delete(segmentKey);
          _warmedSegments.add(segmentKey);
        }
      }
    } catch {
      /* AbortError / network / CORS — silent by design */
    } finally {
      // Drop any still-inflight keys so a later tap can retry cleanly.
      if (_inFlightMaster.has(playbackId) && !_warmedMaster.has(playbackId)) {
        _inFlightMaster.delete(playbackId);
      }
      if (_inFlightMedia.has(playbackId) && !_warmedMedia.has(playbackId)) {
        _inFlightMedia.delete(playbackId);
      }
      if (_inFlightSegments.has(segmentKey) && !_warmedSegments.has(segmentKey)) {
        _inFlightSegments.delete(segmentKey);
      }
      cleanup();
    }
  })();
}
