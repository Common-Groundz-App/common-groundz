
/**
 * Ensures a URL uses HTTPS instead of HTTP
 */
export const ensureHttps = (url: string): string => {
  if (!url) {
    return url || "";
  }
  
  // If it's a relative URL or data URL, return as is
  if (url.startsWith('/') || url.startsWith('data:')) {
    return url;
  }
  
  // If it's already HTTPS, return as is
  if (url.startsWith('https://')) {
    return url;
  }
  
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
