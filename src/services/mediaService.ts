import { generateUUID } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';
import { isAbsoluteUrl, shouldDownloadImage, generateEntityImagePath } from '@/utils/imageUtils';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const validateMediaFile = (file: File): { valid: boolean; error?: string } => {
  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: `Unsupported file type. Allowed types: ${ALLOWED_MEDIA_TYPES.join(', ')}` 
    };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
    };
  }
  
  return { valid: true };
};

export const uploadMedia = async (
  file: File, 
  userId: string,
  sessionId: string,
  onProgress?: (progress: number) => void
): Promise<MediaItem | null> => {
  try {
    const { valid, error } = validateMediaFile(file);
    if (!valid) {
      throw new Error(error);
    }

    // Create a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${generateUUID()}.${fileExt}`;
    const filePath = `${userId}/${sessionId}/${fileName}`;
    
    // Determine the media type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    
    // Upload the file
    const { error: uploadError, data } = await supabase.storage
      .from('post_media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    // Use the progress event manually if onProgress is provided
    if (onProgress) {
      onProgress(100); // Since we can't track progress, mark as complete
    }

    if (uploadError) throw uploadError;
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('post_media')
      .getPublicUrl(filePath);
      
    // Create media item with UUID for stable reordering
    const mediaItem: MediaItem = {
      id: generateUUID(), // Add stable ID for reordering
      url: publicUrl,
      type: isImage ? 'image' : 'video',
      caption: '',
      alt: file.name.split('.')[0], // Default alt text from filename
      order: 0, // Will be set when adding to the array
      session_id: sessionId,
    };
    
    // Log session ID for future implementation
    console.log('Media uploaded with session ID:', sessionId);
    
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

/**
 * Download an image from a URL and store it in Supabase Storage
 * 
 * @param imageUrl The URL of the image to download
 * @param entityId The ID of the entity this image belongs to
 * @param apiSource The source API for the entity (e.g., 'google_places', 'omdb')
 * @returns The public URL of the stored image or null if download failed
 */
export const downloadAndStoreEntityImage = async (
  imageUrl: string,
  entityId: string,
  apiSource: string | null
): Promise<string | null> => {
  try {
    // Validate URL
    if (!isAbsoluteUrl(imageUrl)) {
      console.error('Invalid image URL:', imageUrl);
      return null;
    }

    // Check if this is an Unsplash fallback image - if so, don't store it as an entity image
    if (imageUrl.includes('unsplash.com')) {
      console.error('Refusing to store Unsplash fallback as entity image');
      return null;
    }

    console.log(`Downloading entity image from ${apiSource || 'unknown source'}:`, imageUrl);
    
    // Fetch the image with timeout and error handling
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(imageUrl, { 
        signal: controller.signal,
        headers: {
          // Add referrer and user agent to avoid being blocked
          'Referer': 'https://lovable.dev/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Failed to download image (${response.status}):`, imageUrl);
        return null;
      }
      
      // Get the image as blob
      const imageBlob = await response.blob();
      if (imageBlob.size === 0) {
        console.error('Downloaded image has zero size');
        return null;
      }
      
      // Convert to file with a proper name
      const file = new File(
        [imageBlob], 
        `entity_${entityId}_${Date.now()}.jpg`, 
        { type: imageBlob.type || 'image/jpeg' }
      );
      
      // Generate a path for this entity image
      const filePath = generateEntityImagePath(entityId, apiSource);
      
      // Upload to storage with retry logic
      let uploadAttempts = 0;
      let uploadSuccess = false;
      let uploadError = null;
      let data = null;
      
      while (uploadAttempts < 3 && !uploadSuccess) {
        try {
          const result = await supabase.storage
            .from('entity-images')
            .upload(filePath, file, {
              cacheControl: '31536000', // Cache for 1 year
              upsert: true
            });
            
          uploadError = result.error;
          data = result.data;
          
          if (!uploadError) {
            uploadSuccess = true;
          } else {
            uploadAttempts++;
            console.log(`Upload attempt ${uploadAttempts} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts)); // Exponential backoff
          }
        } catch (err) {
          uploadAttempts++;
          console.error('Upload attempt error:', err);
          await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
        }
      }

      if (uploadError) {
        console.error('Error uploading downloaded entity image after retries:', uploadError);
        return null;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('entity-images')
        .getPublicUrl(filePath);
        
      console.log('Successfully stored entity image:', publicUrl);
      return publicUrl;
    } catch (fetchError) {
      console.error('Error fetching image:', fetchError);
      return null;
    }
    
  } catch (error) {
    console.error('Error in downloadAndStoreEntityImage:', error);
    return null;
  }
};

/**
 * Batch process multiple entity images, downloading and storing them
 * For use in migration scripts or bulk operations
 */
export const batchProcessEntityImages = async (
  entities: Array<{ id: string; image_url: string | null; api_source: string | null; }>
): Promise<Record<string, string | null>> => {
  const results: Record<string, string | null> = {};
  
  // Process in smaller batches with larger delays to avoid overwhelming services
  const batchSize = 3; // Reduced batch size
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(entities.length/batchSize)}`);
    
    // Process this batch in parallel
    const batchPromises = batch.map(async entity => {
      if (!entity.image_url || !shouldDownloadImage(entity.image_url, entity.api_source)) {
        results[entity.id] = entity.image_url; // Keep existing URL if not needing download
        return;
      }
      
      try {
        // Don't store Unsplash fallback images as entity images
        if (entity.image_url.includes('unsplash.com')) {
          console.log(`Skipping Unsplash fallback image for entity ${entity.id}`);
          results[entity.id] = entity.image_url;
          return;
        }
        
        const storedUrl = await downloadAndStoreEntityImage(
          entity.image_url,
          entity.id,
          entity.api_source
        );
        
        // Only update the URL if we successfully stored the image
        if (storedUrl) {
          results[entity.id] = storedUrl;
        } else {
          // Keep the original URL if download fails, but don't replace with fallback
          results[entity.id] = entity.image_url;
          console.log(`Keeping original URL for entity ${entity.id} since download failed`);
        }
      } catch (error) {
        console.error(`Error processing entity ${entity.id}:`, error);
        results[entity.id] = entity.image_url; // Keep original on error
      }
    });
    
    // Wait for this batch to complete before moving to next
    await Promise.all(batchPromises);
    
    // Larger delay between batches to avoid rate limiting
    if (i + batchSize < entities.length) {
      console.log(`Waiting before processing next batch...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between batches
    }
  }
  
  return results;
};
