
import React, { useState, useEffect } from 'react';
import { ensureHttps, getEntityTypeFallbackImage } from '@/utils/urlUtils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  entityType?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ 
  src, 
  fallbackSrc = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07',
  entityType,
  alt,
  onError,
  ...props 
}) => {
  // Use entity-specific fallback if available
  const typeFallback = entityType ? getEntityTypeFallbackImage(entityType) : fallbackSrc;
  const actualFallback = fallbackSrc || typeFallback;
  
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 1; // Reduced to 1 retry to avoid excessive retries and console errors

  useEffect(() => {
    // Reset error state when src changes
    if (src) {
      setHasError(false);
      setRetryCount(0);
      const secureUrl = ensureHttps(src);
      console.log("ImageWithFallback: Processing URL:", secureUrl, "Original:", src);
      
      // Check if it's empty after ensureHttps processing (likely a Google Maps URL)
      if (!secureUrl) {
        console.log("ImageWithFallback: URL was filtered out, using fallback for type:", entityType);
        setImgSrc(actualFallback);
        setHasError(true);
      } else {
        setImgSrc(secureUrl);
      }
    } else {
      console.log("ImageWithFallback: No source URL provided, using fallback for type:", entityType);
      setImgSrc(actualFallback);
    }
  }, [src, actualFallback, entityType]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error("Image load error:", imgSrc, "Entity type:", entityType);
    
    if (!hasError && retryCount < maxRetries && imgSrc && !imgSrc.startsWith('data:')) {
      // Try again with a small delay (network issues)
      setRetryCount(prev => prev + 1);
      setTimeout(() => {
        console.log(`Retrying image load (${retryCount + 1}/${maxRetries}):`, imgSrc);
        // Force a refresh by appending a cache buster
        setImgSrc(`${imgSrc}${imgSrc?.includes('?') ? '&' : '?'}_retry=${Date.now()}`);
      }, 1000);
    } else {
      console.log("Using fallback image after retries for type:", entityType, "Fallback:", actualFallback);
      setImgSrc(actualFallback);
      setHasError(true);
      
      if (onError) {
        onError(e);
      }
    }
  };

  return (
    <img
      src={imgSrc || actualFallback}
      alt={alt}
      onError={handleError}
      {...props}
    />
  );
};
