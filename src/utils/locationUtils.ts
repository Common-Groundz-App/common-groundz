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
  // Prioritize place_id for most accurate results
  if (entity.api_ref) {
    const placeName = entity.venue || entity.name;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}&query_place_id=${encodeURIComponent(entity.api_ref)}`;
  }
  
  // Fallback to coordinates if available
  if (entity.metadata?.coordinates) {
    const { lat, lng } = entity.metadata.coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  
  // Final fallback to generic search
  const address = entity.venue || entity.metadata?.formatted_address || entity.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

/**
 * Opens Google Maps with universal redirect handling
 */
export const openGoogleMaps = (entity: Entity): void => {
  const webUrl = generateGoogleMapsUrl(entity);
  
  // Generate native app URL with place_id for accuracy
  let nativeUrl: string;
  if (entity.api_ref) {
    nativeUrl = `googlemaps://?place_id=${encodeURIComponent(entity.api_ref)}`;
  } else if (entity.metadata?.coordinates) {
    const { lat, lng } = entity.metadata.coordinates;
    nativeUrl = `googlemaps://?q=${lat},${lng}`;
  } else {
    const address = entity.venue || entity.metadata?.formatted_address || entity.name;
    nativeUrl = `googlemaps://?q=${encodeURIComponent(address)}`;
  }
  
  // Universal redirect with blur detection
  let fallbackTimer: NodeJS.Timeout;
  
  const handleBlur = () => {
    clearTimeout(fallbackTimer);
    window.removeEventListener('blur', handleBlur);
  };
  
  // Set up blur event listener to detect successful native app launch
  window.addEventListener('blur', handleBlur);
  
  // Attempt to open native app
  window.location.href = nativeUrl;
  
  // Set fallback timer - if native app doesn't launch, open web version
  fallbackTimer = setTimeout(() => {
    window.removeEventListener('blur', handleBlur);
    window.open(webUrl, '_blank');
  }, 750);
};

/**
 * Checks if an entity has website data
 */
export const hasWebsiteData = (entity: Entity): boolean => {
  return !!entity.website_url && entity.website_url.trim() !== '';
};