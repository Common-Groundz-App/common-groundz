
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

/**
 * Upload media file for posts with proper naming conventions
 * - Uses UUID to prevent naming conflicts
 * - Places files in user-specific folders
 * - Returns metadata for storing in post.media JSONB field
 */
export const uploadPostMedia = async (userId: string, file: File, caption?: string): Promise<{
  url: string;
  type: 'image' | 'video';
  caption?: string;
  order: number;
} | null> => {
  try {
    // Generate UUID for the file to prevent naming conflicts
    const fileUuid = uuidv4();
    
    // Extract file extension
    const fileExt = file.name.split('.').pop();
    
    // Create path with user ID folder structure and UUID in filename
    const path = `${userId}/${fileUuid}-${file.name}`;
    
    // Determine media type based on file MIME type
    const isVideo = file.type.startsWith('video/');
    const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';
    
    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from('post_media')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false // Prevent overwriting existing files
      });

    if (error) {
      console.error('Error uploading media:', error);
      throw error;
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('post_media')
      .getPublicUrl(data.path);

    // Return metadata for storing in post.media JSONB field
    return {
      url: publicUrl,
      type: mediaType,
      ...(caption ? { caption } : {}),
      order: 0 // Default order, can be updated when multiple files are uploaded
    };
  } catch (err) {
    console.error('Error in uploadPostMedia:', err);
    return null;
  }
};

/**
 * Batch upload multiple media files
 * Returns an array of media metadata objects with proper ordering
 */
export const uploadMultiplePostMedia = async (
  userId: string, 
  files: File[],
  captions?: Record<string, string>
): Promise<Array<{
  url: string;
  type: 'image' | 'video';
  caption?: string;
  order: number;
}>> => {
  const mediaUploads = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const caption = captions?.[file.name];
    
    const mediaData = await uploadPostMedia(userId, file, caption);
    
    if (mediaData) {
      // Set the correct order based on the upload index
      mediaData.order = i;
      mediaUploads.push(mediaData);
    }
  }
  
  return mediaUploads;
};

/**
 * Delete a media file from storage
 */
export const deletePostMedia = async (userId: string, fileUrl: string): Promise<boolean> => {
  try {
    // Extract the path from the public URL
    const urlParts = fileUrl.split('/');
    const filePath = `${userId}/${urlParts[urlParts.length - 1]}`;
    
    const { error } = await supabase.storage
      .from('post_media')
      .remove([filePath]);
      
    if (error) {
      console.error('Error deleting media:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error in deletePostMedia:', err);
    return false;
  }
};
