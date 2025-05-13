
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
  orientation?: 'portrait' | 'landscape' | 'square';
  source?: string; // Added this optional property to track the source of media items
}

export type MediaUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface MediaUploadState {
  file: File;
  progress: number;
  status: MediaUploadStatus;
  error?: string;
  item?: MediaItem;
}
