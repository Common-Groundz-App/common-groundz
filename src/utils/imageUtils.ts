
import { ensureHttps } from './urlUtils';

/**
 * Check if a URL is an absolute URL (starts with http:// or https://)
 */
export const isAbsoluteUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
};

/**
 * Check if a URL is likely from Google Places API
 */
export const isGooglePlacesUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.includes('maps.googleapis.com') || url.includes('googleusercontent.com');
};

/**
 * Check if an image URL needs to be downloaded
 * We'll download images from external APIs that might expire:
 * - Google Places images
 * - Any other APIs we determine have expiring URLs
 */
export const shouldDownloadImage = (url: string | null | undefined, apiSource: string | null | undefined): boolean => {
  if (!url) return false;
  
  // Always download Google Places images as they expire
  if (apiSource === 'google_places') return true;
  
  // Check the URL directly for Google domains
  if (isGooglePlacesUrl(url)) return true;
  
  // Add more conditions for other API sources with expiring images as needed
  
  return false;
};

/**
 * Generate a storage path for an entity image
 */
export const generateEntityImagePath = (
  entityId: string, 
  apiSource: string | null | undefined
): string => {
  // Create a path like: entities/{api_source}/{entity_id}/{timestamp}.jpg
  const source = apiSource || 'unknown';
  const timestamp = Date.now();
  return `entities/${source}/${entityId}/${timestamp}.jpg`;
};
