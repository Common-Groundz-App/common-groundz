
export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  caption?: string;
  alt?: string;
  order: number;
  thumbnail_url?: string;
  is_deleted?: boolean;
  session_id?: string;
  id?: string;
  width?: number;
  height?: number;
  duration?: number;
  orientation?: 'portrait' | 'landscape' | 'square';
  source?: string; // Added this optional property to track the source of media items
  category?: string; // Category for photos/videos (general, interior, exterior, menu, etc.)
}

/**
 * Playback state handed off from a feed video to the lightbox so the
 * lightbox can resume at the same timestamp instead of starting at 0:00.
 */
export interface VideoHandoff {
  currentTime: number;
  wasPlaying: boolean;
  muted: boolean;
}

export type MediaUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export type MediaCompatibility = 'checking' | 'compatible' | 'risky';

export interface MediaUploadState {
  file: File;
  progress: number;
  status: MediaUploadStatus;
  error?: string;
  item?: MediaItem;
  /** Soft compatibility hint for video uploads. Not persisted to MediaItem. */
  compatibility?: MediaCompatibility;
  compatibilityNote?: string;
  /** Client-generated poster object URL shown during upload. Revoked on cleanup. */
  localPosterUrl?: string;
  /** Client-detected duration (seconds) shown during upload. */
  localDuration?: number;
  /** Coarse upload stage; drives the staged progress UI. */
  stage?: 'preparing' | 'uploading' | 'finalizing' | 'done';
}

export type MediaUploadStage = NonNullable<MediaUploadState['stage']>;
