
export type MediaProvider = 'supabase' | 'mux';
export type MuxStatus = 'preparing' | 'ready' | 'errored';

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
  /** Review display projection only: the original persisted ID for analytics. Never saved. */
  viewMediaId?: string;
  /**
   * Composer-local render identity (Phase 4 Step 3). Generated once when an
   * item enters composer state; keys React tiles, local preview blob URLs and
   * frozen preview items so adopting the authoritative server `id` after save
   * never remounts or resets the preview. STRICTLY UI-only: never persisted,
   * never sent to the server (the save payload lists fields explicitly).
   */
  clientKey?: string;
  /**
   * Composer-local upload attempt (Posts video placeholder). Together with
   * `clientKey` it decides which late upload results may update this item.
   * UI-only: never persisted, never sent to the server.
   */
  uploadAttemptId?: string;
  width?: number;
  height?: number;
  duration?: number;
  orientation?: 'portrait' | 'landscape' | 'square';
  source?: string; // Added this optional property to track the source of media items
  category?: string; // Category for photos/videos (general, interior, exterior, menu, etc.)
  // ===== Mux integration (Phase 2A — additive, optional) =====
  // Indicates which backend stores/serves this media. Absent = legacy Supabase.
  provider?: MediaProvider;
  mux_upload_id?: string;
  mux_asset_id?: string;
  mux_playback_id?: string;
  mux_status?: MuxStatus;
  mux_error?: string;
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

/**
 * Playback state handed BACK from the lightbox to the originating feed
 * video when the lightbox closes. `entryIndex` is the immutable index
 * the lightbox was opened on; `currentIndex` is where the user is when
 * closing. Timestamp/play resume only applies when they match; mute
 * always syncs because it is a global preference.
 */
export interface VideoExitHandoff {
  currentTime: number;
  wasPlaying: boolean;
  muted: boolean;
  entryIndex: number;
  currentIndex: number;
  /**
   * Phase 4 Step 3 (additive): stable media IDs of the entry item and the
   * item displayed at close. When both are present, resume matching uses
   * these instead of the numeric indices. Absent for ID-less items and for
   * callers on the legacy numeric path — missing keys must never compare
   * equal.
   */
  entryMediaKey?: string;
  currentMediaKey?: string;
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
  /** Review videos: browser couldn't measure length; server decides. */
  durationUnknown?: boolean;
  /** Coarse upload stage; drives the staged progress UI. */
  stage?: 'preparing' | 'uploading' | 'finalizing' | 'done';
  /** Posts video placeholder: composer item identity for this upload attempt. */
  clientKey?: string;
  attemptId?: string;
}

export type MediaUploadStage = NonNullable<MediaUploadState['stage']>;
