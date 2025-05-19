
/**
 * Ensures a URL uses HTTPS instead of HTTP
 */
export const ensureHttps = (url: string): string => {
  if (!url) {
    console.log("ensureHttps: Empty URL provided");
    return url;
  }
  
  // If it's a relative URL, return as is
  if (url.startsWith('/')) {
    return url;
  }
  
  // If it's a data URL, return as is
  if (url.startsWith('data:')) {
    return url;
  }
  
  // If it's already HTTPS, return as is
  if (url.startsWith('https://')) {
    return url;
  }
  
  // If it's an HTTP URL, convert to HTTPS
  if (url.startsWith('http://')) {
    const httpsUrl = `https://${url.slice(7)}`;
    return httpsUrl;
  }
  
  // If there's no protocol, assume HTTPS
  if (!url.includes('://')) {
    const httpsUrl = `https://${url}`;
    return httpsUrl;
  }
  
  return url;
};

/**
 * Validate if a URL is properly formatted
 */
export const isValidUrl = (url: string): boolean => {
  try {
    if (!url) return false;
    
    // Data URLs are always valid
    if (url.startsWith('data:')) return true;
    
    new URL(url);
    return true;
  } catch {
    // Try adding https:// if missing protocol
    try {
      if (!url.includes('://')) {
        new URL(`https://${url}`);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }
};

/**
 * Get fallback image based on entity type
 */
export const getEntityTypeFallbackImage = (type: string | undefined): string => {
  if (!type) return 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&q=80&w=1000';
  
  switch (type.toLowerCase()) {
    case 'book':
      return 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000';
    case 'movie':
      return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1000';
    case 'place':
      return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=1000';
    case 'food':
      return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=1000';
    case 'product':
      return 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&q=80&w=1000';
    default:
      return 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&q=80&w=1000';
  }
};
