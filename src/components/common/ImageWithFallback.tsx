
import React, { useState, useEffect } from 'react';
import { ensureHttps, getEntityTypeFallbackImage } from '@/utils/urlUtils';

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

  useEffect(() => {
    // Reset error state when src changes
    if (src) {
      setHasError(false);
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
    console.log("Image load error, using fallback for type:", entityType);
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
      {...props}
    />
  );
};
