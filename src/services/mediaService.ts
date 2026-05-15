
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

export const validateMediaFile = async (file: File): Promise<{ valid: boolean; error?: string }> => {
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

export const uploadMedia = async (
  file: File,
  userId: string,
  sessionId: string,
  onProgress?: (progress: number, stage?: UploadStage) => void
): Promise<MediaItem | null> => {
  try {
    onProgress?.(0, 'preparing');

    const { valid, error } = await validateMediaFile(file);
    if (!valid) {
      throw new Error(error);
    }

    await ensureBucketPolicies('post_media');

    const fileExt = file.name.split('.').pop();
    const fileName = `${generateUUID()}.${fileExt}`;
    const filePath = `${userId}/${sessionId}/${fileName}`;

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    // For videos, generate the poster BEFORE uploading the video itself,
    // so we have intrinsic dimensions + duration to attach to the MediaItem.
    let posterUrl: string | undefined;
    let videoWidth: number | undefined;
    let videoHeight: number | undefined;
    let videoDuration: number | undefined;

    if (isVideo) {
      try {
        const poster = await generateVideoPoster(file);
        videoWidth = poster.width;
        videoHeight = poster.height;
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

    const orientation = isVideo && videoWidth && videoHeight
      ? orientationFor(videoWidth, videoHeight)
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
      ...(videoWidth ? { width: videoWidth } : {}),
      ...(videoHeight ? { height: videoHeight } : {}),
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
