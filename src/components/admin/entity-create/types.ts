// Phase 3.3A — shared types for the entity-create flow.

/** A locally selected file the admin uploaded in the draft modal but hasn't
 *  saved yet. The File is held in memory; `previewUrl` is a blob: URL used
 *  for preview only. The real CDN URL is resolved at host-form Save time. */
export interface PendingUpload {
  file: File;
  previewUrl: string; // blob: URL — never persisted to DB.
}

/** Phase 3.3A gallery selection. `galleryUrls` may contain either remote
 *  candidate URLs (strings) or pending local uploads (PendingUpload). */
export interface ImageSelectionV2 {
  primaryUrl: string | null;
  /** Whether the current primary is a pending local upload. */
  primaryPending: PendingUpload | null;
  galleryUrls: string[];
  galleryPending: PendingUpload[];
  noImageChosen: boolean;
}

export const isPendingUpload = (v: any): v is PendingUpload =>
  !!v && typeof v === 'object' && v.file instanceof File && typeof v.previewUrl === 'string';

export const MAX_MEDIA_ITEMS = 4;
