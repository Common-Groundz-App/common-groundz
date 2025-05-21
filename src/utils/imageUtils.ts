
// Add the proper import for the supabase client at the top
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Checks if a URL is a valid image URL (superficially)
 * @param url The URL to check
 * @returns True if the URL seems to be a valid image URL
 */
export const isValidImageUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Check for common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const lowercaseUrl = url.toLowerCase();
  const hasImageExtension = imageExtensions.some(ext => lowercaseUrl.includes(ext));
  
  // Check for image-specific domains or paths
  const isImageHosting = 
    lowercaseUrl.includes('imgur.com') || 
    lowercaseUrl.includes('cloudinary.com') || 
    lowercaseUrl.includes('unsplash.com') ||
    lowercaseUrl.includes('maps.googleapis.com/maps/api/place/photo');
  
  return hasImageExtension || isImageHosting || lowercaseUrl.includes('/image/') || lowercaseUrl.includes('/images/');
};

/**
 * Checks if a URL is from Google Places API
 * @param url The URL to check
 * @returns True if the URL is from Google Places API
 */
export const isGooglePlacesImage = (url?: string): boolean => {
  if (!url) return false;
  return url.includes('maps.googleapis.com/maps/api/place/photo');
};

/**
 * Saves an external image to our storage
 * @param imageUrl The external image URL
 * @param entityId The entity ID (used for naming)
 * @returns The new storage URL or null if failed
 */
export const saveExternalImageToStorage = async (imageUrl: string, entityId: string): Promise<string | null> => {
  try {
    if (!imageUrl) {
      console.error('No image URL provided to saveExternalImageToStorage');
      return null;
    }
    
    console.log(`[saveExternalImageToStorage] Attempting to save image for entity ${entityId}: ${imageUrl}`);
    
    // Fetch the image
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`[saveExternalImageToStorage] Failed to fetch image: ${response.status} ${response.statusText}`);
      return null;
    }
    
    // Get the file as a blob
    const blob = await response.blob();
    const fileExt = getFileExtensionFromMimeType(blob.type) || 'jpg';
    const fileName = `${entityId}-${uuidv4()}.${fileExt}`;
    const filePath = `${entityId}/${fileName}`;
    
    console.log(`[saveExternalImageToStorage] Uploading image as ${filePath} with type ${blob.type}`);
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('entity-images')
      .upload(filePath, blob, {
        contentType: blob.type,
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('[saveExternalImageToStorage] Upload error:', uploadError);
      return null;
    }
    
    console.log('[saveExternalImageToStorage] Upload successful:', uploadData);
    
    // Get the public URL - with retry mechanism for potential race conditions
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const { data: { publicUrl } } = supabase
          .storage
          .from('entity-images')
          .getPublicUrl(filePath);
        
        console.log(`[saveExternalImageToStorage] Generated public URL: ${publicUrl}`);
        return publicUrl;
      } catch (error) {
        console.error(`[saveExternalImageToStorage] Error getting public URL (attempt ${attempts + 1}):`, error);
        attempts++;
        
        if (attempts < maxAttempts) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500 * attempts));
        }
      }
    }
    
    console.error(`[saveExternalImageToStorage] Failed to get public URL after ${maxAttempts} attempts`);
    return null;
  } catch (error) {
    console.error('[saveExternalImageToStorage] Error:', error);
    return null;
  }
};

/**
 * Gets file extension based on MIME type
 * @param mimeType The MIME type
 * @returns The file extension without dot
 */
const getFileExtensionFromMimeType = (mimeType: string): string | null => {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp'
  };
  
  return mimeToExt[mimeType] || null;
};
