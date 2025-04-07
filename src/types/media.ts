
export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  caption?: string;
  alt?: string; // Added for accessibility and SEO
  order: number;
  thumbnail_url?: string;
  is_deleted?: boolean;
  session_id?: string;
  id?: string; // Added for stable reordering
}

export type MediaUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface MediaUploadState {
  file: File;
  progress: number;
  status: MediaUploadStatus;
  error?: string;
  item?: MediaItem;
}
