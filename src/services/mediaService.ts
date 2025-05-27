
import { generateUUID } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';
import { ensureBucketPolicies } from '@/services/storageService';

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

    // Ensure bucket policies are set up
    await ensureBucketPolicies('post_media');

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
