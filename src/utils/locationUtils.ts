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
    return `https://www.google.com/maps/search/?api=1&query=place_id:${encodeURIComponent(entity.api_ref)}`;
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
 * Opens Google Maps using universal web URL
 */
export const openGoogleMaps = (entity: Entity): void => {
  const mapsUrl = generateGoogleMapsUrl(entity);
  window.open(mapsUrl, '_blank');
};

/**
 * Checks if an entity has website data
 */
export const hasWebsiteData = (entity: Entity): boolean => {
  return !!entity.website_url && entity.website_url.trim() !== '';
};