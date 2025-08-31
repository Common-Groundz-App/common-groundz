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
 * Opens Google Maps with deep link support for mobile devices
 */
export const openGoogleMaps = (entity: Entity): void => {
  const mapsUrl = generateGoogleMapsUrl(entity);
  
  // More precise mobile detection - check for actual mobile platforms
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && 
                   !/Windows|Macintosh|Linux.*X11/i.test(navigator.userAgent);
  
  // For desktop, open web URL directly
  if (!isMobile) {
    window.open(mapsUrl, '_blank');
    return;
  }
  
  // Mobile-only logic: Try native app first
  let appUrl: string;
  
  // Priority 1: Use place_id for native app if available
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
  
  try {
    // Create a hidden link and click it to trigger the app
    const link = document.createElement('a');
    link.href = appUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Fallback to web after a short delay if app doesn't open (mobile only)
    setTimeout(() => {
      window.open(mapsUrl, '_blank');
    }, 1000);
  } catch (error) {
    // If native app fails, open web URL immediately
    window.open(mapsUrl, '_blank');
  }
};

/**
 * Checks if an entity has website data
 */
export const hasWebsiteData = (entity: Entity): boolean => {
  return !!entity.website_url && entity.website_url.trim() !== '';
};