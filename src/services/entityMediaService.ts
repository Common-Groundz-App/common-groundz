import { MediaItem } from '@/types/media';
import { EntityPhoto, PHOTO_CATEGORIES } from '@/services/entityPhotoService';
import { supabase } from '@/integrations/supabase/client';

/**
 * Service for handling entity media uploads (photos + videos) using MediaUploader
 * Converts between MediaItem (from MediaUploader) and EntityPhoto (for entity storage)
 */

export interface EntityMediaUploadResult {
  success: boolean;
  photo?: EntityPhoto;
  error?: string;
}

export { PHOTO_CATEGORIES };

/**
 * Convert MediaItem to EntityPhoto format for storage
 */
const convertMediaItemToEntityPhoto = (
  mediaItem: MediaItem,
  entityId: string,
  userId: string,
  category: string = 'general',
  caption?: string,
  altText?: string
): Omit<EntityPhoto, 'id' | 'created_at' | 'updated_at' | 'username'> => {
  return {
    entity_id: entityId,
    user_id: userId,
    url: mediaItem.url,
    caption,
    alt_text: altText,
    category,
    status: 'approved' as const,
    moderation_status: 'approved' as const,
    file_size: undefined, // MediaItem doesn't include file size
    width: mediaItem.width,
    height: mediaItem.height,
    content_type: mediaItem.type === 'image' ? 'image/*' : 'video/*'
  };
};

/**
 * Convert EntityPhoto to MediaItem format for display in MediaUploader
 */
export const convertEntityPhotoToMediaItem = (entityPhoto: EntityPhoto): MediaItem => {
  // Determine media type from content_type or URL
  const isVideo = entityPhoto.content_type?.startsWith('video/') || 
                  entityPhoto.url.match(/\.(mp4|webm|mov|avi|3gp|mkv|wmv|flv|m4v)$/i);
  
  return {
    url: entityPhoto.url,
    type: isVideo ? 'video' : 'image',
    caption: entityPhoto.caption,
    alt: entityPhoto.alt_text,
    order: 0, // Will be set by MediaUploader
    width: entityPhoto.width,
    height: entityPhoto.height,
    orientation: entityPhoto.width && entityPhoto.height 
      ? (entityPhoto.width === entityPhoto.height ? 'square' 
         : entityPhoto.width > entityPhoto.height ? 'landscape' : 'portrait')
      : undefined,
    source: 'entity_photos',
    id: entityPhoto.id
  };
};

/**
 * Upload entity media using MediaItem data
 */
export const uploadEntityMedia = async (
  mediaItem: MediaItem,
  entityId: string,
  userId: string,
  category: string = 'general',
  caption?: string,
  altText?: string
): Promise<EntityMediaUploadResult> => {
  try {
    // Convert MediaItem to EntityPhoto format
    const entityPhotoData = convertMediaItemToEntityPhoto(
      mediaItem,
      entityId,
      userId,
      category,
      caption,
      altText
    );

    // Save to entity_photos table
    const { data: photoData, error: dbError } = await supabase
      .from('entity_photos')
      .insert(entityPhotoData)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return { success: false, error: dbError.message };
    }

    console.log('Entity media uploaded successfully:', mediaItem.url);

    return {
      success: true,
      photo: {
        ...photoData,
        status: photoData.status as 'pending' | 'approved' | 'rejected',
        moderation_status: photoData.moderation_status as 'pending' | 'approved' | 'rejected'
      }
    };
  } catch (error) {
    console.error('Entity media upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Handle multiple media uploads from MediaUploader
 * Each MediaItem can have its own caption/alt metadata
 */
export const uploadEntityMediaBatch = async (
  mediaItems: MediaItem[],
  entityId: string,
  userId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<EntityPhoto[]> => {
  const uploadedPhotos: EntityPhoto[] = [];
  
  for (let i = 0; i < mediaItems.length; i++) {
    const mediaItem = mediaItems[i];
    
    // Extract metadata from each individual MediaItem
    const category = (mediaItem.source as string) || 'general';
    const caption = mediaItem.caption;
    const altText = mediaItem.alt;
    
    const result = await uploadEntityMedia(mediaItem, entityId, userId, category, caption, altText);
    
    if (result.success && result.photo) {
      uploadedPhotos.push(result.photo);
    } else {
      console.error(`Failed to upload media item ${i + 1}:`, result.error);
    }
    
    onProgress?.(i + 1, mediaItems.length);
  }
  
  return uploadedPhotos;
};

/**
 * Get media dimensions for validation
 */
export const getMediaDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0 });
      };
      img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
      };
      video.onerror = () => {
        resolve({ width: 0, height: 0 });
      };
      video.src = URL.createObjectURL(file);
    } else {
      resolve({ width: 0, height: 0 });
    }
  });
};