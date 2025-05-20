/**
 * Utilities for handling URLs, especially ensuring HTTPS and providing fallback images
 */

/**
 * Ensure a URL is HTTPS by replacing HTTP with HTTPS.
 * If the URL is already HTTPS or is a data URL, it is returned unchanged.
 */
export const ensureHttps = (url: string | null | undefined): string | null => {
  if (!url) {
    return null;
  }

  if (url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  return url;
};

/**
 * Check if a URL is a Google Places URL
 */
export const isGooglePlacesUrl = (url: string): boolean => {
  return url.includes('maps.googleapis.com/maps/api/place/photo') || url.includes('googleusercontent.com');
};

/**
 * Get a fallback image for an entity type
 */
export const getEntityTypeFallbackImage = (entityType: string): string | null => {
  // Return null to disable fallback images during manual recovery
  return null;
  
  // Original fallback image logic is commented out during manual recovery mode
  /*
  if (!entityType) return 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&q=80&w=1000';
  
  switch (entityType.toLowerCase()) {
    case 'book':
    case 'books':
      return 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000';
    case 'movie':
    case 'movies':
    case 'tv':
    case 'tv show':
    case 'tv shows':
      return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1000';
    case 'place':
    case 'places':
    case 'location':
    case 'travel':
      return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=1000';
    case 'food':
    case 'restaurant':
    case 'restaurants':
      return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=1000';
    default:
      return 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&q=80&w=1000';
  }
  */
};
