
import React, { useState, useEffect } from 'react';
import { ensureHttps } from '@/utils/urlUtils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ 
  src, 
  fallbackSrc = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07',
  alt,
  onError,
  ...props 
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  useEffect(() => {
    // Reset error state when src changes
    if (src) {
      setHasError(false);
      setRetryCount(0);
      const secureUrl = ensureHttps(src);
      console.log("ImageWithFallback: Processing URL:", secureUrl);
      setImgSrc(secureUrl);
    } else {
      setImgSrc(fallbackSrc);
    }
  }, [src, fallbackSrc]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error("Image load error:", imgSrc);
    
    if (!hasError && retryCount < maxRetries) {
      // Try again with a small delay (network issues)
      setRetryCount(prev => prev + 1);
      setTimeout(() => {
        console.log(`Retrying image load (${retryCount + 1}/${maxRetries}):`, imgSrc);
        // Force a refresh by appending a cache buster
        setImgSrc(`${imgSrc}${imgSrc?.includes('?') ? '&' : '?'}_retry=${Date.now()}`);
      }, 1000);
    } else if (!hasError) {
      console.log("Using fallback image after retries");
      setImgSrc(fallbackSrc);
      setHasError(true);
      
      if (onError) {
        onError(e);
      }
    }
  };

  return (
    <img
      src={imgSrc || fallbackSrc}
      alt={alt}
      onError={handleError}
      {...props}
    />
  );
};
