
/**
 * Utilities for handling entity images
 */

import { supabase } from '@/integrations/supabase/client';
import { ensureHttps } from './urlUtils';
import { v4 as uuidv4 } from 'uuid';

// Bucket name for entity images
export const ENTITY_IMAGES_BUCKET = 'entity-images';

/**
 * Validates if a string is a valid image URL
 */
export const isValidImageUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  
  // If it's already a data URL, it's valid
  if (url.startsWith('data:image/')) return true;
  
  // Local URLs (from our storage bucket) are valid
  if (url.includes('uyjtgybbktgapspodajy.supabase.co/storage/v1/object/public/entity-images')) return true;
  
  // Remote image URLs should follow standard image patterns
  const imageExtensionRegex = /\.(jpeg|jpg|gif|png|webp)($|\?)/i;
  
  // Check if it's a Google Places photo URL or has an image extension
  return (
    url.includes('maps.googleapis.com/maps/api/place/photo') || 
    imageExtensionRegex.test(url)
  );
};

/**
 * Download an image from a URL and return as a blob
 */
export const downloadImageFromUrl = async (url: string): Promise<Blob | null> => {
  try {
    const secureUrl = ensureHttps(url);
    const response = await fetch(secureUrl);
    
    if (!response.ok) {
      console.error(`Failed to download image from ${url}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    // Get content type to ensure it's an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.error(`URL does not point to an image: ${url}, content-type: ${contentType}`);
      return null;
    }
    
    return await response.blob();
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error);
    return null;
  }
};

/**
 * Upload an image blob to our Supabase storage and return the public URL
 */
export const uploadImageToStorage = async (
  imageBlob: Blob, 
  entityId: string,
  fileName?: string
): Promise<string | null> => {
  try {
    // Generate file name if not provided
    const fileExt = imageBlob.type.split('/')[1] || 'jpeg';
    const uniqueFileName = fileName || `${entityId}_${uuidv4()}.${fileExt}`;
    const filePath = `${entityId}/${uniqueFileName}`;
    
    // Upload the image to our storage bucket
    const { data, error } = await supabase.storage
      .from(ENTITY_IMAGES_BUCKET)
      .upload(filePath, imageBlob, {
        contentType: imageBlob.type,
        upsert: true
      });
    
    if (error) {
      console.error('Error uploading image to storage:', error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(ENTITY_IMAGES_BUCKET)
      .getPublicUrl(filePath);
      
    return publicUrl;
  } catch (error) {
    console.error('Error in uploadImageToStorage:', error);
    return null;
  }
};

/**
 * Save an external image URL to our storage and return the new URL
 * This handles downloading the image and uploading it to our bucket
 */
export const saveExternalImageToStorage = async (
  imageUrl: string,
  entityId: string
): Promise<string | null> => {
  try {
    // Skip if it's already in our storage
    if (imageUrl.includes(`uyjtgybbktgapspodajy.supabase.co/storage/v1/object/public/${ENTITY_IMAGES_BUCKET}`)) {
      return imageUrl;
    }
    
    // Download the image
    const imageBlob = await downloadImageFromUrl(imageUrl);
    if (!imageBlob) {
      console.error(`Failed to download image from ${imageUrl}`);
      return null;
    }
    
    // Upload to our storage
    return await uploadImageToStorage(imageBlob, entityId);
  } catch (error) {
    console.error(`Error saving external image ${imageUrl} to storage:`, error);
    return null;
  }
};

/**
 * Update an entity's image URL in the database
 */
export const updateEntityImageUrl = async (
  entityId: string,
  imageUrl: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('entities')
      .update({ image_url: imageUrl })
      .eq('id', entityId);
      
    if (error) {
      console.error('Error updating entity image URL:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateEntityImageUrl:', error);
    return false;
  }
};

/**
 * Migrate an entity's external image to our storage
 * Returns true if successful, false otherwise
 */
export const migrateEntityImage = async (entityId: string, currentImageUrl: string): Promise<boolean> => {
  try {
    if (!currentImageUrl || !isValidImageUrl(currentImageUrl)) {
      console.warn(`Invalid image URL for entity ${entityId}: ${currentImageUrl}`);
      return false;
    }
    
    // Check if it's already in our storage
    if (currentImageUrl.includes(`uyjtgybbktgapspodajy.supabase.co/storage/v1/object/public/${ENTITY_IMAGES_BUCKET}`)) {
      console.log(`Entity ${entityId} already using storage image: ${currentImageUrl}`);
      return true;
    }
    
    // Save the external image to our storage
    const newImageUrl = await saveExternalImageToStorage(currentImageUrl, entityId);
    if (!newImageUrl) {
      console.error(`Failed to save external image for entity ${entityId}`);
      return false;
    }
    
    // Update the entity record
    const updated = await updateEntityImageUrl(entityId, newImageUrl);
    if (!updated) {
      console.error(`Failed to update image URL for entity ${entityId}`);
      return false;
    }
    
    console.log(`Successfully migrated image for entity ${entityId} from ${currentImageUrl} to ${newImageUrl}`);
    return true;
  } catch (error) {
    console.error(`Error migrating entity image for ${entityId}:`, error);
    return false;
  }
};

/**
 * Check if an image URL is from Google Places
 */
export const isGooglePlacesImage = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.includes('maps.googleapis.com/maps/api/place/photo');
};
