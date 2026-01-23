/**
 * Entity Image URL Utility
 * 
 * ⚠️ IMPORTANT: ALL UI COMPONENTS MUST USE getOptimalEntityImageUrl()
 * Do NOT access entity.image_url directly anywhere in the codebase.
 * This ensures we always prefer stored photos over proxy URLs that trigger API calls.
 * 
 * Priority order:
 * 1. Stored photos in Supabase Storage (metadata.stored_photo_urls)
 * 2. Direct Supabase Storage URLs (already in image_url)
 * 3. External URLs (Amazon, Unsplash, etc.) - no API cost
 * 4. Proxy URLs (last resort - triggers API call)
 * 
 * SEARCH API CALL POLICY:
 * - Local-only mode (300ms debounce): Searches local database only, NO external API calls
 * - Quick mode (800ms debounce, ≥4 chars): Searches local + external APIs
 * - Results cached for 60 seconds per query
 * - Never gate external APIs by local result count
 */

// Debug flag for logging - only warn in development to avoid production log spam
const DEBUG_IMAGE_UTILS = import.meta.env.DEV;

/**
 * Typed interface for entity image source
 * Ensures consistent usage across all components
 */
export interface EntityImageSource {
  id?: string;
  name?: string;
  image_url?: string | null;
  metadata?: {
    stored_photo_urls?: Array<{
      storedUrl?: string;
      photoReference?: string;
    }>;
    [key: string]: any;
  } | null;
}

/**
 * Check if a URL is a Supabase Storage URL (permanent, no API cost)
 */
export const isStoredImageUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.includes('supabase.co/storage/v1/object')) return true;
  // Proxy URLs are NOT stored
  if (url.includes('proxy-google-image')) return false;
  if (url.includes('proxy-google-books')) return false;
  if (url.includes('proxy-movie-image')) return false;
  // External URLs (Amazon, Unsplash, etc.) are fine - no API cost
  return true;
};

/**
 * Check if a URL is a proxy URL (triggers external API call)
 */
export const isProxyUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes('proxy-google-image') || 
         url.includes('proxy-google-books') || 
         url.includes('proxy-movie-image');
};

/**
 * Get the optimal image URL for an entity
 * Prioritizes stored photos over proxy URLs to minimize API calls
 * 
 * @param entity - Entity object with image_url and metadata
 * @returns The optimal image URL or null
 */
export const getOptimalEntityImageUrl = (entity: EntityImageSource | null | undefined): string | null => {
  if (!entity) return null;
  
  // Priority 1: Check for stored photos in metadata
  const storedPhotos = entity.metadata?.stored_photo_urls;
  if (storedPhotos && Array.isArray(storedPhotos) && storedPhotos.length > 0) {
    const primaryPhoto = storedPhotos.find((p) => p.storedUrl) || storedPhotos[0];
    if (primaryPhoto?.storedUrl) {
      return primaryPhoto.storedUrl;
    }
  }
  
  // Priority 2: Check if image_url is already a Supabase Storage URL
  if (entity.image_url && isStoredImageUrl(entity.image_url)) {
    return entity.image_url;
  }
  
  // Priority 3: Return existing image_url (may be proxy - fallback)
  // Log a warning in dev mode if it's a proxy URL so we can track remaining issues
  if (entity.image_url && isProxyUrl(entity.image_url)) {
    if (DEBUG_IMAGE_UTILS) {
      console.warn(`⚠️ Entity ${entity.name || entity.id} using proxy URL - needs migration`);
    }
  }
  
  return entity.image_url || null;
};

/**
 * Validate an image URL before writing to database
 * Prevents proxy URLs from overwriting stored URLs
 * 
 * @param newImageUrl - The new image URL to potentially write
 * @param existingStoredPhotoUrls - Existing stored photo URLs from metadata
 * @param existingImageUrl - Current image_url in database
 * @returns The validated URL to write
 */
export const validateImageUrlForStorage = (
  newImageUrl: string | null, 
  existingStoredPhotoUrls?: EntityImageSource['metadata']['stored_photo_urls'],
  existingImageUrl?: string | null
): string | null => {
  // If we have stored photos, always prefer them
  if (existingStoredPhotoUrls && existingStoredPhotoUrls.length > 0 && existingStoredPhotoUrls[0]?.storedUrl) {
    if (DEBUG_IMAGE_UTILS) {
      console.log(`📸 Preferring stored URL over: ${newImageUrl?.substring(0, 50)}...`);
    }
    return existingStoredPhotoUrls[0].storedUrl;
  }
  
  // Don't let proxy URLs overwrite existing stored URLs
  if (newImageUrl && isProxyUrl(newImageUrl) && existingImageUrl && isStoredImageUrl(existingImageUrl)) {
    if (DEBUG_IMAGE_UTILS) {
      console.warn(`🛡️ Blocking proxy URL from overwriting stored URL`);
    }
    return existingImageUrl;
  }
  
  // Warn if writing a proxy URL (dev only)
  if (newImageUrl && isProxyUrl(newImageUrl)) {
    if (DEBUG_IMAGE_UTILS) {
      console.warn(`⚠️ Writing proxy URL - should be temporary: ${newImageUrl.substring(0, 50)}...`);
    }
  }
  
  return newImageUrl;
};

/**
 * Get a fallback image URL for an entity type
 */
export const getEntityTypeFallbackImage = (type: string): string => {
  const fallbacks: Record<string, string> = {
    book: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400',
    movie: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
    place: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
    food: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
    product: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    person: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400',
  };
  return fallbacks[type] || fallbacks.product;
};
