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
  const address = entity.venue || entity.metadata?.formatted_address || entity.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

/**
 * Opens Google Maps with deep link support for mobile devices
 */
export const openGoogleMaps = (entity: Entity): void => {
  const mapsUrl = generateGoogleMapsUrl(entity);
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Try to open native app first
    const address = entity.venue || entity.metadata?.formatted_address || entity.name;
    const appUrl = `googlemaps://?q=${encodeURIComponent(address)}`;
    
    // Create a hidden link and click it to trigger the app
    const link = document.createElement('a');
    link.href = appUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Fallback to web after a short delay if app doesn't open
    setTimeout(() => {
      window.open(mapsUrl, '_blank');
    }, 1000);
  } else {
    window.open(mapsUrl, '_blank');
  }
};

/**
 * Checks if an entity has website data
 */
export const hasWebsiteData = (entity: Entity): boolean => {
  return !!entity.website_url && entity.website_url.trim() !== '';
};