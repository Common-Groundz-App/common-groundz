import { supabase } from '@/integrations/supabase/client';
import { ensureBucketPolicies } from '@/services/storageService';

/**
 * Ensures a URL is using HTTPS protocol.
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
 */
export const isGooglePlacesImage = (url: string): boolean => {
  return url?.includes('maps.googleapis.com/maps/api/place/photo');
};

/**
 * Checks if a URL is an OpenLibrary image URL.
 */
export const isOpenLibraryImage = (url: string): boolean => {
  return url?.includes('covers.openlibrary.org');
};

/**
 * Creates a proxy URL for OpenLibrary images
 */
export const createOpenLibraryProxyUrl = (originalUrl: string): string => {
  return `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-openlibrary?url=${encodeURIComponent(originalUrl)}`;
};

/**
 * Checks if a URL is from a CORS-problematic domain
 */
export const isCorsProblematic = (url: string): boolean => {
  if (!url) return false;
  
  const problematicDomains = [
    'books.google.com',
    'images-amazon.com',
    'm.media-amazon.com',
    'images-static.nykaa.com'
    // Removed covers.openlibrary.org since we now proxy it
  ];
  
  return problematicDomains.some(domain => url.includes(domain));
};

/**
 * Returns a fallback image URL based on the entity type.
 */
export const getEntityTypeFallbackImage = (entityType: string): string => {
  const fallbacks: Record<string, string> = {
    'movie': 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1000',
    'book': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000',
    'food': 'https://images.unsplash.com/photo-1555939594-58d7698950b?auto=format&fit=crop&q=80&w=1000',
    'place': 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=1000',
    'product': 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&q=80&w=1000',
    'activity': 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51?auto=format&fit=crop&q=80&w=1000',
    'music': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1000',
    'art': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=1000',
    'tv': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=1000',
    'drink': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=1000',
    'travel': 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?auto=format&fit=crop&q=80&w=1000'
  };
  
  return fallbacks[entityType] || 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=1000';
};

/**
 * Save an external image to Supabase storage with improved error handling and retries
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
    
    // Check if it's a Google Places image and handle specially
    if (isGooglePlacesImage(secureUrl)) {
      console.log('Google Places image detected, using specialized handling:', secureUrl);
      return await handleGooglePlacesImage(secureUrl, entityId);
    }
    
    console.log('Fetching external image for storage:', secureUrl);
    
    // Ensure bucket exists and has proper policies
    await ensureBucketForImage();
    
    // Fetch the image with improved error handling
    const imageBlob = await fetchImageWithRetries(secureUrl);
    if (!imageBlob) {
      return null;
    }
    
    // Upload to storage
    return await uploadImageToStorage(imageBlob, entityId, secureUrl);
    
  } catch (error) {
    console.error('Error saving image to storage:', error);
    return null;
  }
};

/**
 * Handle Google Places images with specialized processing
 */
async function handleGooglePlacesImage(imageUrl: string, entityId: string): Promise<string | null> {
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('No active session found to process Google Places image');
      return imageUrl; // Return original URL as fallback
    }
    
    // Extract the photo reference from the URL
    const url = new URL(imageUrl);
    const photoReference = url.searchParams.get('photoreference');
    
    if (!photoReference) {
      console.warn('No photo reference found in Google Places URL');
      return imageUrl; // Return original URL as fallback
    }
    
    // Call the refresh-entity-image edge function
    console.log('Processing Google Places image with photo reference:', photoReference);
    
    const { data, error } = await supabase.functions.invoke('refresh-entity-image', {
      body: {
        photoReference,
        entityId
      }
    });
    
    if (error) {
      console.error('Error processing Google Places image:', error);
      return imageUrl; // Return original URL as fallback
    }
    
    console.log('Successfully processed Google Places image:', data);
    return data?.imageUrl || imageUrl;
    
  } catch (error) {
    console.error('Error processing Google Places image:', error);
    return imageUrl; // Return original URL as fallback
  }
}

/**
 * Fetch image with retry logic and proper error handling
 */
async function fetchImageWithRetries(imageUrl: string, maxRetries: number = 2): Promise<Blob | null> {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      // Using AbortController to set a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(imageUrl, { 
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const blob = await response.blob();
        
        // Validate blob size
        if (blob.size <= 0) {
          console.error('Received empty image blob from', imageUrl);
          return null;
        }
        
        console.log(`Successfully fetched image: ${blob.size} bytes`);
        return blob;
      }
      
      console.warn(`Fetch attempt ${retryCount + 1} failed with status: ${response.status}`);
      
      // If status is 429 (Too Many Requests) wait longer
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
      }
    } catch (fetchError) {
      console.warn(`Fetch attempt ${retryCount + 1} failed:`, fetchError);
      
      // If it's the last retry, return null
      if (retryCount >= maxRetries) {
        return null;
      }
    }
    
    retryCount++;
    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
  }
  
  return null;
}

/**
 * Upload image blob to Supabase storage
 */
async function uploadImageToStorage(blob: Blob, entityId: string, originalUrl: string): Promise<string | null> {
  try {
    const contentType = blob.type || 'image/jpeg';
    const fileExt = contentType.split('/')[1] || 'jpg';
    const fileName = `${entityId}_${Date.now()}.${fileExt}`;
    const filePath = `${entityId}/${fileName}`;
    
    console.log(`Uploading image to storage: ${filePath} (${contentType}, size: ${blob.size} bytes)`);
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('entity-images')
      .upload(filePath, blob, {
        contentType,
        upsert: false
      });
      
    if (error) {
      console.error('Failed to upload image to storage:', error);
      
      if (error.message.includes('storage/duplicate_file')) {
        console.log('Duplicate file detected, getting public URL');
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
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    return null;
  }
}

// Helper function to ensure the entity-images bucket exists with proper policies
async function ensureBucketForImage() {
  try {
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
