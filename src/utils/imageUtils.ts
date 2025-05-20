import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures a URL is using HTTPS protocol.
 * If the URL is already HTTPS, it returns the original URL.
 * If the URL is HTTP, it replaces the protocol with HTTPS.
 * If the URL is relative or doesn't start with HTTP/HTTPS, it returns null.
 *
 * @param url The URL to check and convert.
 * @returns The HTTPS URL, or null if the input is invalid.
 */
export const ensureHttps = (url: string): string | null => {
  if (!url) {
    return null;
  }

  if (url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  // Check if it's a data URL
  if (url.startsWith('data:')) {
    return url;
  }

  console.warn('Invalid URL format:', url);
  return null;
};

/**
 * Checks if a URL is a valid image URL.
 *
 * @param url The URL to check.
 * @returns True if the URL is valid, false otherwise.
 */
export const isValidImageUrl = (url: string): boolean => {
  if (!url) {
    return false;
  }

  // Check if the URL starts with "http://" or "https://"
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
    console.warn('URL does not start with http://, https://, or data::', url);
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch (error) {
    console.warn('Invalid URL:', url, error);
    return false;
  }
};

/**
 * Checks if a URL is a Google Places image URL.
 *
 * @param url The URL to check.
 * @returns True if the URL is a Google Places image URL, false otherwise.
 */
export const isGooglePlacesImage = (url: string): boolean => {
  return url.includes('maps.googleapis.com/maps/api/place/photo');
};

/**
 * Returns a fallback image URL based on the entity type.
 *
 * @param entityType The type of entity.
 * @returns The fallback image URL.
 */
export const getEntityTypeFallbackImage = (entityType: string): string => {
  switch (entityType) {
    case 'movie':
      return '/movie_fallback.jpg';
    case 'book':
      return '/book_fallback.jpg';
    case 'food':
      return '/food_fallback.jpg';
    case 'product':
      return '/product_fallback.jpg';
    case 'place':
      return '/place_fallback.jpg';
    default:
      return '/placeholder.svg';
  }
};

/**
 * Save an external image to Supabase storage
 * @param imageUrl URL of the external image
 * @param entityId ID of the entity to associate with the image
 * @returns Public URL of the stored image or null if failed
 */
export const saveExternalImageToStorage = async (imageUrl: string, entityId: string): Promise<string | null> => {
  try {
    // Convert any non-HTTPS URLs to HTTPS
    const secureUrl = ensureHttps(imageUrl);
    
    if (!secureUrl) {
      console.error('Invalid image URL for storage migration:', imageUrl);
      return null;
    }
    
    // Fetch the image
    const response = await fetch(secureUrl);
    if (!response.ok) {
      console.error('Failed to fetch image for storage migration:', secureUrl);
      return null;
    }
    
    // Get image data
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const fileExt = contentType.split('/')[1] || 'jpg';
    const fileName = `${entityId}_${Date.now()}.${fileExt}`;
    const filePath = `${entityId}/${fileName}`;
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('entity-images')
      .upload(filePath, blob, {
        contentType,
        upsert: false
      });
      
    if (error) {
      console.error('Failed to upload image to storage:', error);
      return null;
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('entity-images')
      .getPublicUrl(filePath);
      
    console.log('Image saved to storage:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error saving image to storage:', error);
    return null;
  }
};
