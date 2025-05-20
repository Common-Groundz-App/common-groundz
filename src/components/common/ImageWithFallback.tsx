
import React, { useState, useEffect } from 'react';
import { ensureHttps, getEntityTypeFallbackImage } from '@/utils/urlUtils';
import { isValidImageUrl, isGooglePlacesImage } from '@/utils/imageUtils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  entityType?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ 
  src, 
  fallbackSrc,
  entityType,
  alt,
  onError,
  ...props 
}) => {
  // Use entity-specific fallback if available
  const typeFallback = entityType ? getEntityTypeFallbackImage(entityType) : undefined;
  // Prioritize explicitly provided fallback, then type fallback
  const actualFallback = fallbackSrc || typeFallback || 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07';
  
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 1; // One retry attempt for transient failures

  useEffect(() => {
    // Reset error state when src changes
    if (src) {
      setHasError(false);
      setRetryCount(0);
      
      if (!isValidImageUrl(src)) {
        // If URL is invalid after processing, use fallback
        console.log("ImageWithFallback: Invalid image URL, using fallback for entity type:", entityType);
        setImgSrc(actualFallback);
        setHasError(true);
        return;
      }
      
      const secureUrl = ensureHttps(src);
      
      if (!secureUrl) {
        // If URL is empty after processing, use fallback
        console.log("ImageWithFallback: Using fallback image for entity type:", entityType);
        setImgSrc(actualFallback);
        setHasError(true);
      } else {
        setImgSrc(secureUrl);
      }
    } else {
      // No source provided, use fallback
      console.log("ImageWithFallback: No source URL provided, using fallback for type:", entityType);
      setImgSrc(actualFallback);
    }
  }, [src, actualFallback, entityType]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // For Google Places URLs, which can be problematic, try one retry
    const isGooglePlaces = imgSrc && isGooglePlacesImage(imgSrc);
    
    if (!hasError && retryCount < maxRetries && imgSrc && !imgSrc.startsWith('data:')) {
      // Try once more (network issues)
      setRetryCount(prev => prev + 1);
      
      if (isGooglePlaces) {
        console.log("Google Places image failed to load, trying with cache buster:", imgSrc);
        // For Google Places URLs, add a cache buster
        setTimeout(() => {
          const cacheBuster = `cb=${Date.now()}`;
          setImgSrc(`${imgSrc}${imgSrc?.includes('?') ? '&' : '?'}${cacheBuster}`);
        }, 500);
      } else {
        // For other URLs, just retry once after a short delay
        setTimeout(() => {
          console.log(`Retrying image load (${retryCount + 1}/${maxRetries}):`, imgSrc);
          setImgSrc(`${imgSrc}`);
        }, 500);
      }
    } else {
      console.log("Image load error, using fallback for type:", entityType);
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
