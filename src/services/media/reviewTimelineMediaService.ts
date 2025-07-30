import { MediaItem } from '@/types/media';
import { uploadMedia, validateMediaFile, deleteMedia } from '@/services/mediaService';

/**
 * Service for handling media uploads specifically for review timeline updates
 */

export const uploadReviewTimelineMedia = async (
  files: File[],
  userId: string,
  reviewId: string,
  onProgress?: (fileName: string, progress: number) => void
): Promise<MediaItem[]> => {
  const uploadedMedia: MediaItem[] = [];
  const sessionId = `review-timeline-${reviewId}-${Date.now()}`;

  for (const file of files) {
    // Validate file
    const validation = await validateMediaFile(file);
    if (!validation.valid) {
      throw new Error(`${file.name}: ${validation.error}`);
    }

    try {
      const mediaItem = await uploadMedia(file, userId, sessionId, (progress) => {
        onProgress?.(file.name, progress);
      });

      if (mediaItem) {
        uploadedMedia.push(mediaItem);
      }
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      throw new Error(`Failed to upload ${file.name}`);
    }
  }

  return uploadedMedia;
};

export const deleteReviewTimelineMedia = async (mediaItems: MediaItem[]): Promise<void> => {
  const deletePromises = mediaItems.map(media => deleteMedia(media.url));
  await Promise.all(deletePromises);
};

export const validateReviewTimelineMedia = async (files: File[]): Promise<{ valid: boolean; errors: string[] }> => {
  const errors: string[] = [];
  
  for (const file of files) {
    const validation = await validateMediaFile(file);
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};