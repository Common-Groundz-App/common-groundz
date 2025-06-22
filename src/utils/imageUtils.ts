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
 * Checks if a URL is a Google Books image URL.
 */
export const isGoogleBooksImage = (url: string): boolean => {
  return url?.includes('books.google.com/books/content');
};

/**
 * Checks if a URL is a movie image URL that needs proxying.
 */
export const isMovieImage = (url: string): boolean => {
  return url?.includes('image.tmdb.org') || url?.includes('imdb.com');
};

/**
 * Creates a proxy URL for OpenLibrary images
 */
export const createOpenLibraryProxyUrl = (originalUrl: string): string => {
  return `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-openlibrary?url=${encodeURIComponent(originalUrl)}`;
};

/**
 * Creates a proxy URL for Google Books images
 */
export const createGoogleBooksProxyUrl = (originalUrl: string): string => {
  return `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-books?url=${encodeURIComponent(originalUrl)}`;
};

/**
 * Creates a proxy URL for movie images
 */
export const createMovieProxyUrl = (originalUrl: string): string => {
  return `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-movie-image?url=${encodeURIComponent(originalUrl)}`;
};

/**
 * Creates a proxy URL for generic external images
 */
export const createGenericProxyUrl = (originalUrl: string): string => {
  return `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-external-image?url=${encodeURIComponent(originalUrl)}`;
};

/**
 * Checks if a URL is from a CORS-problematic domain (expanded coverage)
 */
export const isCorsProblematic = (url: string): boolean => {
  if (!url) return false;
  
  const problematicDomains = [
    // Social media
    'instagram.com', 'cdninstagram.com', 'fbcdn.net',
    'pinterest.com', 'pinimg.com',
    'twitter.com', 'twimg.com',
    'facebook.com',
    
    // E-commerce
    'amazon.com', 'images-amazon.com', 'm.media-amazon.com',
    'ebay.com', 'ebayimg.com',
    'walmart.com', 'walmartimages.com',
    'target.com', 'target.scene7.com',
    'shopify.com', 'shopifycdn.com',
    
    // News sites
    'cnn.com', 'cdn.cnn.com',
    'bbc.com', 'bbci.co.uk',
    'reuters.com', 'reuters.tv',
    'nytimes.com', 'nyt.com',
    
    // Image hosts with CORS issues
    'imgur.com', 'i.imgur.com',
    'flickr.com', 'staticflickr.com', 'live.staticflickr.com',
    
    // Other problematic domains
    'googleusercontent.com',
    'images-static.nykaa.com'
  ];
  
  return problematicDomains.some(domain => url.includes(domain));
};

/**
 * Gets the appropriate proxy URL for an external image based on its source
 */
export const getProxyUrlForImage = (originalUrl: string): string => {
  if (!originalUrl) return originalUrl;
  
  // Specific proxy functions for known sources
  if (isGooglePlacesImage(originalUrl)) {
    // Google Places images are handled differently via refresh-entity-image function
    return originalUrl;
  }
  
  if (isOpenLibraryImage(originalUrl)) {
    return createOpenLibraryProxyUrl(originalUrl);
  }
  
  if (isGoogleBooksImage(originalUrl)) {
    return createGoogleBooksProxyUrl(originalUrl);
  }
  
  if (isMovieImage(originalUrl)) {
    return createMovieProxyUrl(originalUrl);
  }
  
  // Generic proxy for other CORS-problematic domains
  if (isCorsProblematic(originalUrl)) {
    return createGenericProxyUrl(originalUrl);
  }
  
  // Return original URL if no proxy needed
  return originalUrl;
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
 * Save an external image to Supabase storage with improved error handling and smart proxy routing
 * @param imageUrl URL of the external image
 * @param entityId ID of the entity to associate with the image
 * @returns Public URL of the stored image or null if failed
 */
export const saveExternalImageToStorage = async (imageUrl: string, entityId: string): Promise<string | null> => {
  try {
    console.log('Starting image save process for entity:', entityId);
    
    // Validate entity ID
    if (!entityId || entityId === 'temp-id') {
      console.error('Invalid entity ID provided for image storage:', entityId);
      return null;
    }
    
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
    
    // Get the appropriate URL (proxy if needed)
    const fetchUrl = getProxyUrlForImage(secureUrl);
    console.log('Using fetch URL (may be proxied):', fetchUrl);
    
    // Fetch the image with improved error handling and retries
    const imageBlob = await fetchImageWithRetries(fetchUrl, 3);
    if (!imageBlob) {
      console.warn('Failed to fetch image after retries, keeping external URL:', secureUrl);
      return secureUrl; // Return original URL as fallback
    }
    
    // Upload to storage with retries
    return await uploadImageToStorageWithRetries(imageBlob, entityId, secureUrl, 2);
    
  } catch (error) {
    console.error('Error saving image to storage:', error);
    return imageUrl; // Return original URL as fallback
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
async function fetchImageWithRetries(imageUrl: string, maxRetries: number = 3): Promise<Blob | null> {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      console.log(`Fetching image attempt ${retryCount + 1}/${maxRetries + 1}:`, imageUrl);
      
      // Using AbortController to set a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(imageUrl, { 
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (compatible; EntityApp/1.0)'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const blob = await response.blob();
        
        // Validate blob size and type
        if (blob.size <= 0) {
          console.error('Received empty image blob from', imageUrl);
          throw new Error('Empty image blob');
        }
        
        if (blob.size > 10 * 1024 * 1024) { // 10MB limit
          console.error('Image too large:', blob.size, 'bytes');
          throw new Error('Image too large');
        }
        
        console.log(`Successfully fetched image: ${blob.size} bytes, type: ${blob.type}`);
        return blob;
      }
      
      console.warn(`Fetch attempt ${retryCount + 1} failed with status: ${response.status}`);
      
      if (response.status === 404) {
        console.error('Image not found (404), stopping retries');
        return null;
      }
      
    } catch (fetchError) {
      console.warn(`Fetch attempt ${retryCount + 1} failed:`, fetchError);
    }
    
    retryCount++;
    if (retryCount <= maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error('All fetch attempts failed for:', imageUrl);
  return null;
}

/**
 * Upload image blob to Supabase storage with retry logic
 */
async function uploadImageToStorageWithRetries(blob: Blob, entityId: string, originalUrl: string, maxRetries: number = 2): Promise<string | null> {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      const contentType = blob.type || 'image/jpeg';
      const fileExt = getFileExtensionFromContentType(contentType);
      const fileName = `${Date.now()}_${generateSafeFileName(originalUrl)}.${fileExt}`;
      const filePath = `${entityId}/${fileName}`;
      
      console.log(`Upload attempt ${retryCount + 1}/${maxRetries + 1}: ${filePath} (${contentType}, size: ${blob.size} bytes)`);
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('entity-images')
        .upload(filePath, blob, {
          contentType,
          upsert: false
        });
        
      if (error) {
        if (error.message.includes('storage/duplicate_file')) {
          console.log('Duplicate file detected, getting public URL');
          const { data: { publicUrl } } = supabase.storage
            .from('entity-images')
            .getPublicUrl(filePath);
          return publicUrl;
        }
        
        console.error(`Upload attempt ${retryCount + 1} failed:`, error);
        throw error;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('entity-images')
        .getPublicUrl(filePath);
        
      console.log('Image saved to storage successfully:', publicUrl);
      return publicUrl;
      
    } catch (error) {
      console.error(`Upload attempt ${retryCount + 1} error:`, error);
      retryCount++;
      
      if (retryCount <= maxRetries) {
        const delay = 1000 * retryCount;
        console.log(`Waiting ${delay}ms before upload retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('All upload attempts failed, returning original URL as fallback');
  return originalUrl; // Return original URL as final fallback
}

/**
 * Generate a safe filename from URL
 */
function generateSafeFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1] || 'image';
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
  } catch {
    return 'image';
  }
}

/**
 * Get file extension from content type
 */
function getFileExtensionFromContentType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg'
  };
  
  return typeMap[contentType.toLowerCase()] || 'jpg';
}

/**
 * Ensures a bucket exists and has proper policies
 */
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
