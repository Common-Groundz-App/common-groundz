
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
  
  // Handle Google Maps photo URLs properly
  // These are valid and should be processed normally, not rejected
  if (url.includes('maps.googleapis.com/maps/api/place/photo')) {
    return url; // Keep Google Maps photo URLs as they are
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
