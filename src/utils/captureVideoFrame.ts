/**
 * Best-effort JPEG dataURL snapshot of a <video>'s current visible frame.
 *
 * Returns null on any failure (tainted canvas / SecurityError, pre-first-frame,
 * zero dimensions, missing 2D context, decoding quirks). Never throws.
 *
 * Tuned for a 1-3s visual bridge between a feed video and a lightbox open —
 * NOT for archival quality. Defaults: 640px max width, JPEG 0.65 (~80-120KB).
 */
export function captureVideoFrame(
  v: HTMLVideoElement | null | undefined,
  opts?: { maxWidth?: number; quality?: number }
): string | null {
  try {
    if (!v) return null;
    // readyState >= 2 (HAVE_CURRENT_DATA) means there's a current frame to draw.
    if (v.readyState < 2) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return null;

    const maxW = opts?.maxWidth ?? 640;
    const scale = vw > maxW ? maxW / vw : 1;
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', opts?.quality ?? 0.65);
  } catch {
    return null;
  }
}
