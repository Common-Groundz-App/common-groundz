import { Entity } from '@/services/recommendation/types';

/**
 * Checks if an entity has location data from Google Places API
 */
export const hasLocationData = (entity: Entity): boolean => {
  return entity.api_source === 'google_places' && 
         (!!entity.venue || !!entity.metadata?.formatted_address);
};

/**
 * Generates a Google Maps URL for the given entity
 */
export const generateGoogleMapsUrl = (entity: Entity): string => {
  // Priority 1: Use Google Places place_id for maximum accuracy
  if (entity.api_ref) {
    const placeName = entity.venue || entity.name;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}&query_place_id=${entity.api_ref}`;
  }
  
  // Priority 2: Use coordinates if available
  const lat = entity.metadata?.geometry?.location?.lat || entity.metadata?.lat;
  const lng = entity.metadata?.geometry?.location?.lng || entity.metadata?.lng;
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  
  // Priority 3: Enhanced address search with better formatting
  const venue = entity.venue;
  const formattedAddress = entity.metadata?.formatted_address;
  
  if (venue && formattedAddress) {
    // Use both venue name and address for disambiguation
    const searchQuery = `${venue}, ${formattedAddress}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  }
  
  // Priority 4: Fallback to individual address components
  const address = venue || formattedAddress || entity.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

/**
 * Opens Google Maps with blur event detection for native app fallback
 */
export const openGoogleMaps = (entity: Entity): void => {
  const mapsUrl = generateGoogleMapsUrl(entity);
  
  // Build native app URL with place_id priority
  let appUrl: string;
  if (entity.api_ref) {
    appUrl = `googlemaps://?place_id=${encodeURIComponent(entity.api_ref)}`;
  } else {
    // Priority 2: Use coordinates for native app
    const lat = entity.metadata?.geometry?.location?.lat || entity.metadata?.lat;
    const lng = entity.metadata?.geometry?.location?.lng || entity.metadata?.lng;
    if (lat && lng) {
      appUrl = `googlemaps://?q=${lat},${lng}`;
    } else {
      // Priority 3: Fallback to address search
      const address = entity.venue || entity.metadata?.formatted_address || entity.name;
      appUrl = `googlemaps://?q=${encodeURIComponent(address)}`;
    }
  }
  
  // The fallback timer. If the native app doesn't launch, this will run
  const fallbackTimeout = setTimeout(() => {
    window.open(mapsUrl, '_blank');
  }, 750); // Increased delay to allow mobile apps enough time to launch

  // A listener that clears the fallback timer if the app launches successfully
  window.addEventListener('blur', () => {
    clearTimeout(fallbackTimeout);
  });

  // Attempt to open the native app URL
  window.location.href = appUrl;
};

/**
 * Gets the normalized website URL from an entity
 * Checks both admin-entered and API-fetched sources
 */
export const getEntityWebsiteUrl = (entity: Entity): string | null => {
  // Priority 1: Admin-entered website (takes precedence)
  const adminWebsite = entity.website_url?.trim();
  
  // Priority 2: API-fetched website (e.g., from Google Places)
  const apiWebsite = entity.specifications?.website?.trim();
  
  const rawUrl = adminWebsite || apiWebsite;
  
  if (!rawUrl) return null;
  
  // Ensure the URL has a protocol
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    return `https://${rawUrl}`;
  }
  
  return rawUrl;
};

/**
 * Checks if an entity has website data
 */
export const hasWebsiteData = (entity: Entity): boolean => {
  return getEntityWebsiteUrl(entity) !== null;
};