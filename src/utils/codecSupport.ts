/**
 * Codec compatibility helpers.
 * In Phase 1 we don't transcode, so iPhone-recorded MOV files using
 * HEVC/H.265 may not play for every viewer. We detect this client-side
 * and warn the user without blocking the upload.
 */

let probe: HTMLVideoElement | null = null;
const getProbe = () => {
  if (!probe) probe = document.createElement('video');
  return probe;
};

export function browserSupportsHEVC(): boolean {
  const v = getProbe();
  // Common HEVC MIME types across browsers
  const candidates = [
    'video/mp4; codecs="hvc1"',
    'video/mp4; codecs="hev1"',
    'video/mp4; codecs="hvc1.1.6.L93.B0"',
  ];
  return candidates.some((c) => {
    try {
      return v.canPlayType(c) !== '';
    } catch {
      return false;
    }
  });
}

/**
 * Quick check: can the browser play this specific File at all?
 * Resolves true if the video element fires loadedmetadata, false otherwise.
 */
export function canBrowserPlayFile(file: File, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(ok);
    };

    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => finish(true);
    v.onerror = () => finish(false);
    v.src = url;

    setTimeout(() => finish(false), timeoutMs);
  });
}

/**
 * Heuristic: a MOV that the browser cannot decode is most likely HEVC.
 * Returns a user-facing warning string when risky, or null when safe.
 */
export async function detectHEVCRisk(file: File): Promise<string | null> {
  const isMov =
    file.type === 'video/quicktime' || /\.mov$/i.test(file.name);
  if (!isMov) return null;

  // If the user's own browser can't even play it, viewers likely won't either.
  const playable = await canBrowserPlayFile(file);
  if (playable && browserSupportsHEVC()) return null;

  return "This iPhone video may not play for all viewers. For best results, record in 'Most Compatible' mode (H.264) or upload an MP4.";
}
