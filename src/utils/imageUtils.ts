
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
  return url?.includes('maps.googleapis.com/maps/api/place/photo');
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
    
    // Check if it's a Google Places image
    if (isGooglePlacesImage(secureUrl)) {
      console.log('Google Places image detected. These should be handled by the refresh-entity-image function:', secureUrl);
      
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No active session found to process Google Places image');
          return secureUrl; // Return original URL as fallback
        }
        
        // Extract the photo reference from the URL
        const url = new URL(secureUrl);
        const photoReference = url.searchParams.get('photoreference');
        const placeId = url.searchParams.get('placeid'); // Some URLs might include this
        
        if (!photoReference) {
          console.warn('No photo reference found in Google Places URL');
          return secureUrl; // Return original URL as fallback
        }
        
        // Call the refresh-entity-image edge function with the photo reference and improved headers
        console.log('Calling refresh-entity-image with photo reference:', photoReference);
        
        const { data, error } = await supabase.functions.invoke('refresh-entity-image', {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: {
            photoReference,
            placeId, // This might be null, but that's okay
            entityId
          }
        });
        
        console.log('Edge function response:', data, 'Error:', error);
        
        if (error) {
          console.error('Error response from refresh-entity-image:', error);
          return secureUrl; // Return original URL as fallback
        }
        
        if (!data) {
          console.error('No data returned from refresh-entity-image');
          return secureUrl; // Return original URL as fallback
        }
        
        console.log('Successfully processed Google Places image:', data);
        
        // Also update the entity directly to ensure it's saved
        if (data.imageUrl) {
          const { error: updateError } = await supabase
            .from('entities')
            .update({ image_url: data.imageUrl })
            .eq('id', entityId);
            
          if (updateError) {
            console.error('Error updating entity with processed image URL:', updateError);
            
            // Implement retry logic for critical updates
            console.log('Retrying entity image update...');
            let retrySuccess = false;
            
            for (let i = 0; i < 3 && !retrySuccess; i++) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
              
              const { error: retryError } = await supabase
                .from('entities')
                .update({ image_url: data.imageUrl })
                .eq('id', entityId);
                
              if (!retryError) {
                console.log(`Successfully updated entity image URL on retry attempt ${i + 1}`);
                retrySuccess = true;
              } else {
                console.error(`Retry attempt ${i + 1} failed:`, retryError);
              }
            }
          } else {
            console.log('Entity updated with new image URL after processing');
          }
        }
        
        return data.imageUrl || secureUrl;
      } catch (googlePlacesError) {
        console.error('Error processing Google Places image:', googlePlacesError);
        return secureUrl; // Return original URL as fallback
      }
    }
    
    console.log('Fetching external image for storage:', secureUrl);
    
    // Check if the entity-images bucket exists and ensure bucket policies
    await ensureBucketForImage();
    
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
            'Pragma': 'no-cache',
            'Accept': '*/*'
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
        
        // Try to ensure bucket policies as a recovery step
        await ensureBucketPolicies();
        
        // Try the upload one more time
        const { data: retryData, error: retryError } = await supabase.storage
          .from('entity-images')
          .upload(filePath, blob, {
            contentType,
            upsert: false
          });
          
        if (retryError) {
          console.error('Retry upload still failed:', retryError);
          return null;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('entity-images')
          .getPublicUrl(filePath);
        return publicUrl;
      }
      
      return null;
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('entity-images')
      .getPublicUrl(filePath);
      
    console.log('Image saved to storage successfully:', publicUrl);
    
    // Also update the entity directly to ensure it's saved
    const { error: updateError } = await supabase
      .from('entities')
      .update({ image_url: publicUrl })
      .eq('id', entityId);
      
    if (updateError) {
      console.error('Error updating entity with saved image URL:', updateError);
    } else {
      console.log('Entity updated with new image URL after storage save');
    }
    
    return publicUrl;
  } catch (error) {
    console.error('Error saving image to storage:', error);
    return null;
  }
};

// Helper function to ensure the entity-images bucket exists with proper policies
async function ensureBucketForImage() {
  try {
    // Import the needed functions
    const { ensureBucketExists, ensureBucketPolicies } = await import('@/services/storageService');
    
    // Ensure the bucket exists
    const bucketExists = await ensureBucketExists('entity-images', true);
    
    if (!bucketExists) {
      console.error('Failed to ensure entity-images bucket exists');
      return false;
    }
    
    // Ensure the bucket has proper policies
    const policiesSet = await ensureBucketPolicies('entity-images');
    
    if (!policiesSet) {
      console.warn('Could not set policies for entity-images bucket');
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring bucket for image:', error);
    return false;
  }
}

// Helper function to ensure bucket policies
async function ensureBucketPolicies() {
  try {
    const { ensureBucketPolicies } = await import('@/services/storageService');
    return await ensureBucketPolicies('entity-images');
  } catch (error) {
    console.error('Error ensuring bucket policies:', error);
    return false;
  }
}
