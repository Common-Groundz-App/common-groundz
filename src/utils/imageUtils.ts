
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
    console.log('Starting image save process for entity:', entityId);
    
    // Convert any non-HTTPS URLs to HTTPS
    const secureUrl = ensureHttps(imageUrl);
    
    if (!secureUrl) {
      console.error('Invalid image URL for storage migration:', imageUrl);
      return null;
    }
    
    // Skip URLs that are already in our storage
    if (secureUrl.includes('entity-images') || secureUrl.includes('storage.googleapis.com')) {
      console.log('Image already in storage, skipping:', secureUrl);
      return secureUrl;
    }
    
    // Skip Google Places images - they need to be handled by the refresh-entity-image function
    if (isGooglePlacesImage(secureUrl)) {
      console.log('Google Places image detected, should be handled by refresh-entity-image function:', secureUrl);
      return secureUrl;
    }
    
    console.log('Fetching external image for storage:', secureUrl);
    
    // Check if the entity-images bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing storage buckets:', bucketsError);
      return null;
    }
    
    const bucketExists = buckets.some(b => b.name === 'entity-images');
    if (!bucketExists) {
      console.error('entity-images bucket does not exist. Please create it first.');
      return null;
    }
    
    // Fetch the image with retries
    let response;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        // Using AbortController to set a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        response = await fetch(secureUrl, { 
          signal: controller.signal,
          headers: {
            // Add a cache-busting query parameter to the URL
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          break; // Successful response, exit retry loop
        }
        
        console.warn(`Fetch attempt ${retryCount + 1} failed with status: ${response.status}`);
        
        // If status is 429 (Too Many Requests) wait longer
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        }
      } catch (fetchError) {
        console.warn(`Fetch attempt ${retryCount + 1} failed:`, fetchError);
        
        // If it's the last retry, re-throw the error
        if (retryCount >= maxRetries) {
          throw fetchError;
        }
      }
      
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
    
    if (!response || !response.ok) {
      console.error('Failed to fetch image for storage migration:', response?.status, response?.statusText);
      throw new Error(`Failed to fetch image: ${response?.status} ${response?.statusText}`);
    }
    
    // Get image data
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const fileExt = contentType.split('/')[1] || 'jpg';
    const fileName = `${entityId}_${Date.now()}.${fileExt}`;
    const filePath = `${entityId}/${fileName}`;
    
    console.log(`Uploading image to storage: ${filePath} (${contentType}, size: ${blob.size} bytes)`);
    
    // Validate blob size
    if (blob.size <= 0) {
      console.error('Received empty image blob from', secureUrl);
      return null;
    }
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('entity-images')
      .upload(filePath, blob, {
        contentType,
        upsert: false
      });
      
    if (error) {
      // Log detailed error information
      console.error('Failed to upload image to storage:', error);
      
      if (error.message.includes('storage/duplicate_file')) {
        console.log('Duplicate file detected, attempting to get public URL anyway');
        const { data: { publicUrl } } = supabase.storage
          .from('entity-images')
          .getPublicUrl(filePath);
        return publicUrl;
      }
      
      // Check if it's a permission error
      if (error.message.includes('storage/permission_denied')) {
        console.error('Permission denied error. Check RLS policies for entity-images bucket');
      }
      
      return null;
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('entity-images')
      .getPublicUrl(filePath);
      
    console.log('Image saved to storage successfully:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error saving image to storage:', error);
    return null;
  }
};

