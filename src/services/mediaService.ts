
import { generateUUID } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';
import { ensureBucketPolicies } from '@/services/storageService';
import { generateVideoPoster } from '@/utils/videoPoster';
import { analytics } from '@/services/analytics';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// Phase 1: only formats with broad cross-browser support.
// MOV is allowed but may carry HEVC — we surface a soft warning at the composer.
export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .MOV — iPhone/macOS
];
export const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_VIDEO_DURATION = 60; // seconds
export const MAX_VIDEOS_PER_POST = 1;

// Helper to get image intrinsic dimensions
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      URL.revokeObjectURL(url);
      if (!w || !h) reject(new Error('Image has no intrinsic dimensions'));
      else resolve({ width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error loading image metadata'));
    };
    img.src = url;
  });
};

// Helper function to get video duration
export const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error('Error loading video metadata'));
    };
    video.src = URL.createObjectURL(file);
  });
};

const orientationFor = (w: number, h: number): 'portrait' | 'landscape' | 'square' => {
  if (!w || !h) return 'landscape';
  const r = w / h;
  if (r > 1.05) return 'landscape';
  if (r < 0.95) return 'portrait';
  return 'square';
};

/**
 * Review video Phase 4: `unknownDurationAllowed` (review composers only) makes
 * an unreadable / non-finite length an explicit, allowed state — the server's
 * own Mux measurement then decides (over 60 s becomes "too long"). Without the
 * option (posts) behaviour is unchanged.
 */
export interface ValidateMediaOptions {
  unknownDurationAllowed?: boolean;
}

export const validateMediaFile = async (
  file: File,
  opts: ValidateMediaOptions = {},
): Promise<{ valid: boolean; error?: string; durationUnknown?: boolean }> => {
  const isVideo = file.type.startsWith('video/');

  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    if (isVideo) {
      return {
        valid: false,
        error: 'Format not supported. Use MP4, MOV, or WebM.',
      };
    }
    return {
      valid: false,
      error: 'Format not supported. Use JPEG, PNG, GIF, or WebP.',
    };
  }

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: isVideo
        ? 'Video too large. Max 100 MB.'
        : 'Image too large. Max 10 MB.',
    };
  }

  if (isVideo) {
    try {
      const duration = await getVideoDuration(file);
      if (opts.unknownDurationAllowed && !Number.isFinite(duration)) {
        return { valid: true, durationUnknown: true };
      }
      if (duration > MAX_VIDEO_DURATION) {
        return {
          valid: false,
          error: 'Video too long. Keep it under 60 seconds.',
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Unable to read video. Try MP4, MOV, or WebM.',
      };
    }
  }

  return { valid: true };
};

export type UploadStage = 'preparing' | 'uploading' | 'finalizing' | 'done';

// ===== Runtime Mux config (admin-controlled via app_config) =====
export interface MuxFlags {
  uploadsEnabled: boolean;
  mode: 'live' | 'test';
}

const ENV_FALLBACK_ENABLED =
  (import.meta.env.VITE_MUX_UPLOAD_ENABLED ?? 'false').toString().toLowerCase() === 'true';

let _muxCfgCache: { value: MuxFlags; at: number } | null = null;
const MUX_CFG_TTL_MS = 30_000;

export async function resolveMuxConfig(): Promise<MuxFlags> {
  if (_muxCfgCache && Date.now() - _muxCfgCache.at < MUX_CFG_TTL_MS) {
    return _muxCfgCache.value;
  }
  try {
    const { data, error } = await supabase.rpc('get_public_flags');
    if (error) throw error;
    const mux = (data as any)?.mux ?? {};
    const value: MuxFlags = {
      uploadsEnabled: mux.uploads_enabled ?? ENV_FALLBACK_ENABLED,
      mode: mux.mode === 'test' ? 'test' : 'live',
    };
    _muxCfgCache = { value, at: Date.now() };
    return value;
  } catch {
    return { uploadsEnabled: ENV_FALLBACK_ENABLED, mode: 'live' };
  }
}

export function __resetMuxConfigCache(): void {
  _muxCfgCache = null;
}

/** @deprecated Use resolveMuxConfig() — kept for any synchronous callers. */
export const isMuxEnabled = (): boolean => ENV_FALLBACK_ENABLED;

export const VIDEO_UPLOADS_UNAVAILABLE = 'Video uploads are unavailable right now. Try again later.';

export interface UploadMediaOptions {
  /** Operational metadata only; never authorization or deletion authority. */
  muxKind?: 'post' | 'review' | 'review_update';
  /**
   * Review composers: videos must go to Mux. No storage fallback; a disabled
   * or failing Mux surfaces as an error. Sends the browser-reported size
   * (non-authoritative) so the server can refuse > 100 MB early.
   */
  videoMuxOnly?: boolean;
  /** Post Mux videos only: cancels this attempt (skips or aborts the PUT). */
  signal?: AbortSignal;
  /**
   * Post Mux videos only: a poster that finished after the item was emitted.
   * Fires at most once, only for a non-cancelled attempt. Display-only; the
   * server rebuilds url/thumbnail from Mux on save.
   */
  onLatePoster?: (muxUploadId: string, patch: LatePosterPatch) => void;
}

export interface LatePosterPatch {
  url: string;
  thumbnail_url: string;
  width?: number;
  height?: number;
}

/** How long a finished PUT waits for the background poster before emitting. */
export const POST_POSTER_GRACE_MS = 1500;

export const uploadMedia = async (
  file: File,
  userId: string,
  sessionId: string,
  onProgress?: (progress: number, stage?: UploadStage) => void,
  options: UploadMediaOptions = {}
): Promise<MediaItem | null> => {
  try {
    onProgress?.(0, 'preparing');

    const { valid, error } = await validateMediaFile(file, { unknownDurationAllowed: !!options.videoMuxOnly });
    if (!valid) {
      throw new Error(error);
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    // ===== Review composers: Mux-only videos, never the storage fallback =====
    if (isVideo && options.videoMuxOnly) {
      const cfg = await resolveMuxConfig();
      if (!cfg.uploadsEnabled) throw new Error(VIDEO_UPLOADS_UNAVAILABLE);
      return await uploadVideoViaMux(file, userId, sessionId, onProgress, file.size, options.muxKind);
    }

    // ===== Mux upload branch (videos only, runtime-flag gated) =====
    if (isVideo) {
      const cfg = await resolveMuxConfig();
      if (cfg.uploadsEnabled) {
        try {
          // Fix 3 (Posts only): poster work runs off the critical path.
          return await uploadPostVideoViaMux(file, userId, sessionId, onProgress, options);
        } catch (err: any) {
          // Parse FunctionsHttpError: body lives on err.context as an unread Response.
          // Scoped to mux-create-upload call only — fallback strictly on MUX_DISABLED,
          // never on bare HTTP status (so real Mux outages still surface as errors).
          let code: string | undefined =
            err?.code ?? err?.error ?? err?.body?.error ?? err?.body?.code;
          if (!code && err?.context && typeof err.context.clone === 'function') {
            try {
              const parsed = await err.context.clone().json();
              code = parsed?.code ?? parsed?.error;
            } catch {
              // body not JSON — leave code undefined, do NOT fallback
            }
          }
          if (code === 'MUX_DISABLED') {
            __resetMuxConfigCache();
            analytics.track('mux_fallback_to_supabase', { reason: 'server_disabled' });
            // fall through to Supabase path — silent, user upload still succeeds
          } else {
            throw err;
          }
        }
      }
    }




    await ensureBucketPolicies('post_media');

    const fileExt = file.name.split('.').pop();
    const fileName = `${generateUUID()}.${fileExt}`;
    const filePath = `${userId}/${sessionId}/${fileName}`;

    // (isImage/isVideo already computed above)


    // For videos, generate the poster BEFORE uploading the video itself,
    // so we have intrinsic dimensions + duration to attach to the MediaItem.
    let posterUrl: string | undefined;
    let mediaWidth: number | undefined;
    let mediaHeight: number | undefined;
    let videoDuration: number | undefined;

    if (isVideo) {
      try {
        const poster = await generateVideoPoster(file);
        mediaWidth = poster.width;
        mediaHeight = poster.height;
        videoDuration = poster.duration;

        const posterPath = `${userId}/${sessionId}/${generateUUID()}_poster.jpg`;
        const { error: posterErr } = await supabase.storage
          .from('post_media')
          .upload(posterPath, poster.posterBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          });
        if (!posterErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('post_media')
            .getPublicUrl(posterPath);
          posterUrl = publicUrl;
        }
      } catch (err) {
        // Non-fatal: video still uploads without a poster.
        console.warn('Poster generation failed:', err);
      }
    } else if (isImage) {
      try {
        const dims = await getImageDimensions(file);
        mediaWidth = dims.width;
        mediaHeight = dims.height;
      } catch (err) {
        // Non-fatal: image still uploads; runtime fallback will measure later.
        console.warn('Image dimension probe failed:', err);
      }
    }

    onProgress?.(0, 'uploading');

    const { error: uploadError } = await supabase.storage
      .from('post_media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    onProgress?.(0, 'finalizing');

    const { data: { publicUrl } } = supabase.storage
      .from('post_media')
      .getPublicUrl(filePath);

    const orientation = mediaWidth && mediaHeight
      ? orientationFor(mediaWidth, mediaHeight)
      : undefined;

    const mediaItem: MediaItem = {
      id: generateUUID(),
      url: publicUrl,
      type: isImage ? 'image' : 'video',
      caption: '',
      alt: file.name.split('.')[0],
      order: 0,
      session_id: sessionId,
      ...(posterUrl ? { thumbnail_url: posterUrl } : {}),
      ...(mediaWidth ? { width: mediaWidth } : {}),
      ...(mediaHeight ? { height: mediaHeight } : {}),
      ...(videoDuration ? { duration: videoDuration } : {}),
      ...(orientation ? { orientation } : {}),
    };

    if (isVideo) {
      analytics.trackVideoUploaded({
        size: file.size,
        duration: videoDuration ?? 0,
        format: file.type,
        orientation: orientation ?? 'landscape',
      });
    }

    onProgress?.(100, 'done');
    return mediaItem;
  } catch (error) {
    console.error('Error uploading media:', error);
    return null;
  }
};

export const deleteMedia = async (url: string): Promise<boolean> => {
  try {
    // Extract the path from the URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    // Find the 'post_media' part and take everything after it
    const bucketIndex = pathParts.findIndex(part => part === 'post_media');
    if (bucketIndex === -1) return false;
    
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    const { error } = await supabase.storage
      .from('post_media')
      .remove([filePath]);
      
    return !error;
  } catch (error) {
    console.error('Error deleting media:', error);
    return false;
  }
};

// Helper function to clean up unused media files
export const cleanupUnusedMedia = async (userId: string, sessionId: string): Promise<void> => {
  try {
    const path = `${userId}/${sessionId}`;
    const { data: files, error } = await supabase.storage
      .from('post_media')
      .list(path);
      
    if (error || !files || files.length === 0) return;
    
    const filesToRemove = files.map(file => `${path}/${file.name}`);
    
    await supabase.storage
      .from('post_media')
      .remove(filesToRemove);
  } catch (error) {
    console.error('Error cleaning up unused media:', error);
  }
};

// ===== Phase 2B: Mux upload helpers =====
// Edge function source of truth: supabase/functions/mux-create-upload/index.ts
// Response shape: { upload_id, upload_url, is_test, expires_at }

interface MuxCreateUploadResponse {
  upload_id: string;
  upload_url: string;
  is_test: boolean;
  expires_at: string;
}

/**
 * Upload a video via Mux Direct Upload.
 *
 * Phase 2B: hard-fails (no Supabase fallback) so we can see real problems
 * during testing. Requires a non-empty poster URL — poster failure aborts.
 */
async function uploadVideoViaMux(
  file: File,
  userId: string,
  sessionId: string,
  onProgress?: (progress: number, stage?: UploadStage) => void,
  declaredSize?: number,
  kind?: UploadMediaOptions['muxKind']
): Promise<MediaItem> {
  analytics.trackMuxUploadAttempt({ size: file.size, format: file.type });

  // ---- Step 1: poster (REQUIRED) ----
  await ensureBucketPolicies('post_media');

  let posterUrl: string;
  let mediaWidth: number;
  let mediaHeight: number;
  let videoDuration: number;
  let posterPath: string;

  try {
    const poster = await generateVideoPoster(file);
    mediaWidth = poster.width;
    mediaHeight = poster.height;
    videoDuration = poster.duration;

    posterPath = `${userId}/${sessionId}/${generateUUID()}_poster.jpg`;
    const { error: posterErr } = await supabase.storage
      .from('post_media')
      .upload(posterPath, poster.posterBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg',
      });
    if (posterErr) throw posterErr;

    const { data: { publicUrl } } = supabase.storage
      .from('post_media')
      .getPublicUrl(posterPath);
    if (!publicUrl) throw new Error('Empty poster public URL');
    posterUrl = publicUrl;
  } catch (err: any) {
    analytics.trackMuxUploadFailure({
      stage: 'poster',
      error: err?.message ?? String(err),
      size: file.size,
      format: file.type,
    });
    throw new Error("Couldn't prepare video preview. Try again.");
  }

  // ---- Step 2: create Mux direct upload ----
  let upload: MuxCreateUploadResponse;
  try {
    const { data, error } = await supabase.functions.invoke<MuxCreateUploadResponse>(
      'mux-create-upload',
      { body: { ...(typeof declaredSize === 'number' ? { declared_size: declaredSize } : {}), ...(kind ? { kind } : {}) } }
    );
    if (error) throw error;
    if (!data?.upload_id || !data?.upload_url) {
      throw new Error('Invalid mux-create-upload response');
    }
    upload = data;
  } catch (err: any) {
    // Best-effort poster cleanup
    deleteMedia(posterUrl).catch(() => {});
    analytics.trackMuxUploadFailure({
      stage: 'create_upload',
      error: err?.message ?? String(err),
      size: file.size,
      format: file.type,
    });
    throw new Error("Couldn't start video upload. Try again.");
  }

  onProgress?.(0, 'uploading');

  // ---- Step 3: PUT the file to Mux ----
  try {
    await putWithProgress(upload.upload_url, file, (pct) => {
      onProgress?.(pct, 'uploading');
    });
  } catch (err: any) {
    deleteMedia(posterUrl).catch(() => {});
    analytics.trackMuxUploadFailure({
      stage: 'put',
      error: err?.message ?? String(err),
      size: file.size,
      format: file.type,
      upload_id: upload.upload_id,
    });
    throw new Error("Video upload failed. Check your connection and try again.");
  }

  onProgress?.(0, 'finalizing');

  const orientation = orientationFor(mediaWidth, mediaHeight);

  analytics.trackMuxUploadSuccess({
    size: file.size,
    duration: videoDuration,
    format: file.type,
    orientation,
    upload_id: upload.upload_id,
    is_test: upload.is_test,
  });

  const mediaItem: MediaItem = {
    id: generateUUID(),
    url: posterUrl, // poster URL until mux_status === 'ready' (2A guards prevent playback)
    thumbnail_url: posterUrl,
    type: 'video',
    caption: '',
    alt: file.name.split('.')[0],
    order: 0,
    session_id: sessionId,
    width: mediaWidth,
    height: mediaHeight,
    duration: videoDuration,
    orientation,
    provider: 'mux',
    mux_upload_id: upload.upload_id,
    mux_status: 'preparing',
  };

  onProgress?.(100, 'done');
  return mediaItem;
}

/**
 * Fix 3 — Post composer Mux upload. Poster generation/storage starts in
 * parallel with the Mux handshake, and the video PUT starts as soon as the
 * upload URL arrives; the poster never gates byte 0. Readiness stays
 * server-authoritative (the item is emitted as `preparing`). Review/Timeline
 * keep `uploadVideoViaMux` unchanged.
 */
async function uploadPostVideoViaMux(
  file: File,
  userId: string,
  sessionId: string,
  onProgress?: (progress: number, stage?: UploadStage) => void,
  options: UploadMediaOptions = {}
): Promise<MediaItem> {
  const { signal, onLatePoster } = options;
  const aborted = () => !!signal?.aborted;
  analytics.trackMuxUploadAttempt({ size: file.size, format: file.type });
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const mark = (step: string, extra?: Record<string, unknown>) => {
    if (!import.meta.env.DEV) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try { console.debug(`[post-video-timing] ${step} +${Math.round(now - t0)}ms`, extra ?? ''); } catch { /* ignore */ }
  };

  type PosterResult = { url: string; width: number; height: number; duration: number } | null;
  const posterTask: Promise<PosterResult> = (async () => {
    try {
      mark('poster started');
      const poster = await generateVideoPoster(file);
      if (aborted()) return null;
      await ensureBucketPolicies('post_media');
      const posterPath = `${userId}/${sessionId}/${generateUUID()}_poster.jpg`;
      const { error } = await supabase.storage.from('post_media')
        .upload(posterPath, poster.posterBlob, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('post_media').getPublicUrl(posterPath);
      if (!publicUrl) throw new Error('Empty poster public URL');
      if (aborted()) { deleteMedia(publicUrl).catch(() => {}); return null; }
      mark('poster finished');
      return { url: publicUrl, width: poster.width, height: poster.height, duration: poster.duration };
    } catch (err: any) {
      // Non-fatal: Mux provides the trusted thumbnail once Ready.
      analytics.trackMuxUploadFailure({ stage: 'poster', error: err?.message ?? String(err), size: file.size, format: file.type });
      return null;
    }
  })();
  const discardPoster = () => { posterTask.then((p) => { if (p) deleteMedia(p.url).catch(() => {}); }); };

  let upload: MuxCreateUploadResponse;
  try {
    mark('link requested');
    const { data, error } = await supabase.functions.invoke<MuxCreateUploadResponse>('mux-create-upload', { body: { kind: 'post' } });
    mark('link received');
    if (error) throw error;
    if (!data?.upload_id || !data?.upload_url) throw new Error('Invalid mux-create-upload response');
    upload = data;
  } catch (err: any) {
    discardPoster();
    analytics.trackMuxUploadFailure({ stage: 'create_upload', error: err?.message ?? String(err), size: file.size, format: file.type });
    throw new Error("Couldn't start video upload. Try again.");
  }

  if (aborted()) { discardPoster(); throw new Error('Upload cancelled'); }
  onProgress?.(0, 'uploading');
  try {
    let firstByte = false;
    await putWithProgress(upload.upload_url, file, (pct) => {
      if (!firstByte && pct > 0) { firstByte = true; mark('first bytes sent'); }
      onProgress?.(pct, 'uploading');
    }, signal, () => {
      // Every byte has left the browser; Mux has not confirmed yet.
      mark('all bytes sent');
      onProgress?.(100, 'finalizing');
    }, (status) => mark('server response', { status }));
  } catch (err: any) {
    discardPoster();
    if (aborted()) throw new Error('Upload cancelled');
    analytics.trackMuxUploadFailure({ stage: 'put', error: err?.message ?? String(err), size: file.size, format: file.type, upload_id: upload.upload_id });
    throw new Error("Video upload failed. Check your connection and try again.");
  }

  mark('upload confirmed');
  onProgress?.(100, 'finalizing');
  // Bounded wait: the poster is cosmetic; never hold the item hostage to it.
  const TIMED_OUT = Symbol('timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const raced = await Promise.race([
    posterTask,
    new Promise<typeof TIMED_OUT>((r) => { timer = setTimeout(() => r(TIMED_OUT), POST_POSTER_GRACE_MS); }),
  ]);
  if (timer) clearTimeout(timer);
  mark(raced === TIMED_OUT ? 'poster wait timed out' : 'poster wait done');
  const poster = raced === TIMED_OUT ? null : raced;

  if (aborted()) { discardPoster(); throw new Error('Upload cancelled'); }

  if (raced === TIMED_OUT) {
    // Late poster enhances only this attempt, and only if it is still active.
    posterTask.then((p) => {
      if (!p) return;
      if (aborted() || !onLatePoster) { deleteMedia(p.url).catch(() => {}); return; }
      onLatePoster(upload.upload_id, { url: p.url, thumbnail_url: p.url, width: p.width, height: p.height });
    });
  }

  const orientation = poster ? orientationFor(poster.width, poster.height) : undefined;
  analytics.trackMuxUploadSuccess({
    size: file.size, duration: poster?.duration ?? 0, format: file.type,
    orientation: orientation ?? 'landscape', upload_id: upload.upload_id, is_test: upload.is_test,
  });

  mark('upload step finished');
  onProgress?.(100, 'done');
  return {
    id: generateUUID(),
    url: poster?.url ?? '',
    ...(poster ? { thumbnail_url: poster.url, width: poster.width, height: poster.height, duration: poster.duration } : {}),
    ...(orientation ? { orientation } : {}),
    type: 'video',
    caption: '',
    alt: file.name.split('.')[0],
    order: 0,
    session_id: sessionId,
    provider: 'mux',
    mux_upload_id: upload.upload_id,
    mux_status: 'preparing',
  };
}

/**
 * PUT a file via XMLHttpRequest so we get real upload progress events
 * (fetch() can't observe request-body progress in browsers).
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
  onSent?: () => void,
  onResponse?: (status: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Mux PUT aborted')); return; }
    const xhr = new XMLHttpRequest();
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.open('PUT', url, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.upload.onload = () => { try { onSent?.(); } catch { /* ignore */ } };
    xhr.onload = () => {
      try { onResponse?.(xhr.status); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Mux PUT failed: ${xhr.status} ${xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error('Network error during Mux PUT'));
    xhr.onabort = () => reject(new Error('Mux PUT aborted'));
    xhr.send(file);
  });
}
