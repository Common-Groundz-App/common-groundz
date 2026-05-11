/**
 * Video poster utilities — Phase 1 video support.
 * Generates a JPEG poster thumbnail from a video file client-side
 * and extracts intrinsic dimensions / duration in a single pass.
 */

export interface VideoPosterResult {
  posterBlob: Blob;
  width: number;
  height: number;
  duration: number;
}

const POSTER_MAX_WIDTH = 640;
const POSTER_QUALITY = 0.8;
const SEEK_TIME = 0.1; // seconds — first real frame, avoids black opener

export async function generateVideoPoster(file: File): Promise<VideoPosterResult> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    const onError = (msg: string) => {
      cleanup();
      reject(new Error(msg));
    };

    video.onloadedmetadata = () => {
      // Seek to first frame
      try {
        video.currentTime = Math.min(SEEK_TIME, (video.duration || 1) / 2);
      } catch {
        onError('Unable to seek video for poster');
      }
    };

    video.onseeked = () => {
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) {
          onError('Video has no intrinsic dimensions');
          return;
        }

        const scale = vw > POSTER_MAX_WIDTH ? POSTER_MAX_WIDTH / vw : 1;
        const cw = Math.round(vw * scale);
        const ch = Math.round(vh * scale);

        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onError('Canvas 2D context unavailable');
          return;
        }
        ctx.drawImage(video, 0, 0, cw, ch);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error('Failed to encode poster image'));
              return;
            }
            resolve({
              posterBlob: blob,
              width: vw,
              height: vh,
              duration: video.duration || 0,
            });
          },
          'image/jpeg',
          POSTER_QUALITY
        );
      } catch (err) {
        onError((err as Error).message || 'Poster generation failed');
      }
    };

    video.onerror = () => onError('Unable to load video for poster');
  });
}

/** Format seconds as M:SS for badge display. */
export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format bytes to a short human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
