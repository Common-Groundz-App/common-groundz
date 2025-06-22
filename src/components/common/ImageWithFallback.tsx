
import React, { useState, useEffect } from 'react';
import { ensureHttps } from '@/utils/urlUtils';
import { isValidImageUrl, getProxyUrlForImage, getEntityTypeFallbackImage } from '@/utils/imageUtils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  entityType?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  suppressConsoleErrors?: boolean;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ 
  src, 
  fallbackSrc,
  entityType,
  alt,
  onError,
  suppressConsoleErrors = false,
  ...props 
}) => {
  // Use entity-specific fallback if available
  const typeFallback = entityType ? getEntityTypeFallbackImage(entityType) : undefined;
  // Prioritize explicitly provided fallback, then type fallback
  const actualFallback = fallbackSrc || typeFallback || 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07';
  
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [proxyAttempted, setProxyAttempted] = useState(false);

  // Process URL using smart proxy routing
  const processUrl = (url: string): string => {
    if (!url) return url;
    
    // First ensure HTTPS
    const secureUrl = ensureHttps(url);
    if (!secureUrl) return url;
    
    // Then apply appropriate proxy if needed
    const proxyUrl = getProxyUrlForImage(secureUrl);
    
    if (proxyUrl !== secureUrl && !suppressConsoleErrors) {
      console.log('ImageWithFallback: Using proxy for:', secureUrl, '-> proxy URL:', proxyUrl);
    }
    
    return proxyUrl;
  };

  useEffect(() => {
    // Reset error state when src changes
    if (src) {
      setHasError(false);
      setProxyAttempted(false);
      
      if (!suppressConsoleErrors) {
        console.log('ImageWithFallback: Processing image URL:', src);
      }
      
      // Process the URL (convert to HTTPS and apply proxy if needed)
      const processedUrl = processUrl(src);
      
      // Basic URL validation
      if (!isValidImageUrl(processedUrl)) {
        if (!suppressConsoleErrors) {
          console.log("ImageWithFallback: Invalid image URL format, using fallback for entity type:", entityType);
        }
        setImgSrc(actualFallback);
        setHasError(true);
        return;
      }
      
      if (!suppressConsoleErrors) {
        console.log('ImageWithFallback: Using processed URL:', processedUrl);
      }
      
      setImgSrc(processedUrl);
    } else {
      if (!suppressConsoleErrors) {
        console.log("ImageWithFallback: No source URL provided, using fallback for type:", entityType);
      }
      setImgSrc(actualFallback);
    }
  }, [src, actualFallback, entityType, suppressConsoleErrors]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!suppressConsoleErrors) {
      console.log('ImageWithFallback: Image load error, using fallback for type:', entityType, 'Original URL:', src);
    }
    
    // If we haven't tried a direct fetch yet and the current URL was proxied, try direct
    if (src && !proxyAttempted && getProxyUrlForImage(src) !== src) {
      setProxyAttempted(true);
      const directUrl = ensureHttps(src);
      if (directUrl && !suppressConsoleErrors) {
        console.log('ImageWithFallback: Proxy failed, trying direct URL:', directUrl);
      }
      setImgSrc(directUrl || actualFallback);
      return;
    }
    
    setImgSrc(actualFallback);
    setHasError(true);
    
    if (onError) {
      onError(e);
    }
  };

  return (
    <img
      src={imgSrc || actualFallback}
      alt={alt}
      onError={handleError}
      crossOrigin="anonymous"
      {...props}
    />
  );
};
