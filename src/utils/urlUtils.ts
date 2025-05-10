
/**
 * Ensures a URL uses HTTPS instead of HTTP
 */
export const ensureHttps = (url: string): string => {
  if (!url) return url;
  
  // If it's a relative URL, return as is
  if (url.startsWith('/')) return url;
  
  // Handle google API URLs with photo references that may not need modification
  if (url.includes('maps.googleapis.com/maps/api/place/photo')) {
    console.log("Google Places photo URL detected:", url);
    return url;
  }
  
  // If it's already HTTPS, return as is
  if (url.startsWith('https://')) return url;
  
  // If it's an HTTP URL, convert to HTTPS
  if (url.startsWith('http://')) {
    return `https://${url.slice(7)}`;
  }
  
  // If there's no protocol, assume HTTPS
  if (!url.includes('://')) {
    return `https://${url}`;
  }
  
  return url;
};

/**
 * Validate if a URL is properly formatted
 */
export const isValidUrl = (url: string): boolean => {
  try {
    if (!url) return false;
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
