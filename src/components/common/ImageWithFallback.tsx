import React, { useState, useEffect } from 'react';
import { ensureHttps } from '@/utils/urlUtils';
import { isValidImageUrl, isGooglePlacesImage, getEntityTypeFallbackImage } from '@/utils/imageUtils';

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
  const maxRetries = 1;

  // Check if URL has CORS issues and needs proxying (updated for Google Places proxy)
  const needsProxy = (url: string): boolean => {
    if (!url) return false;
    
    // Don't proxy our own proxy URLs
    if (url.includes('supabase.co/functions/v1/get-google-places-photo')) {
      return false;
    }
    
    // Known problematic domains that need CORS proxy
    const corsProblematicDomains = [
      'covers.openlibrary.org',
      'books.google.com',
      'images-amazon.com',
      'm.media-amazon.com',
      'maps.googleapis.com' // Google Places direct URLs
    ];
    
    return corsProblematicDomains.some(domain => url.includes(domain));
  };

  // Create proxy URL for CORS-problematic images
  const createProxyUrl = (originalUrl: string): string => {
    // Use a simple CORS proxy service
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`;
  };

  useEffect(() => {
    // Reset error state when src changes
    if (src) {
      setHasError(false);
      setRetryCount(0);
      
      console.log('ImageWithFallback: Processing image URL:', src);
      
      if (!isValidImageUrl(src) && !src.includes('supabase.co/functions/v1/get-google-places-photo')) {
        console.log("ImageWithFallback: Invalid image URL, using fallback for entity type:", entityType);
        setImgSrc(actualFallback);
        setHasError(true);
        return;
      }
      
      const secureUrl = ensureHttps(src);
      
      if (!secureUrl && !src.includes('supabase.co/functions/v1/get-google-places-photo')) {
        console.log("ImageWithFallback: Using fallback image for entity type:", entityType);
        setImgSrc(actualFallback);
        setHasError(true);
      } else {
        // For our Google Places proxy URLs, use them directly
        if (src.includes('supabase.co/functions/v1/get-google-places-photo')) {
          console.log('ImageWithFallback: Using Google Places proxy URL:', src);
          setImgSrc(src);
        }
        // Check if URL needs CORS proxy
        else if (needsProxy(secureUrl)) {
          console.log("ImageWithFallback: Using CORS proxy for:", secureUrl);
          const proxiedUrl = createProxyUrl(secureUrl);
          setImgSrc(proxiedUrl);
        } else {
          setImgSrc(secureUrl);
        }
      }
    } else {
      console.log("ImageWithFallback: No source URL provided, using fallback for type:", entityType);
      setImgSrc(actualFallback);
    }
  }, [src, actualFallback, entityType]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const currentUrl = imgSrc;
    
    console.log('ImageWithFallback: Image load error for URL:', currentUrl);
    
    if (!hasError && retryCount < maxRetries && currentUrl) {
      setRetryCount(prev => prev + 1);
      
      // If it's a Google Places proxy URL that failed, try fallback immediately
      if (currentUrl.includes('supabase.co/functions/v1/get-google-places-photo')) {
        console.log('Google Places proxy failed, using fallback for type:', entityType);
        setImgSrc(actualFallback);
        setHasError(true);
        if (onError) {
          onError(e);
        }
        return;
      }
      
      // If the original URL was proxied and failed, try the original
      if (currentUrl.includes('allorigins.win') && src) {
        console.log("Proxy failed, trying original URL:", src);
        const secureUrl = ensureHttps(src);
        setImgSrc(secureUrl);
        return;
      }
      
      // If original URL failed and it needs proxy, try proxy
      if (!currentUrl.includes('allorigins.win') && src && needsProxy(src)) {
        console.log("Original URL failed, trying proxy:", src);
        const proxiedUrl = createProxyUrl(ensureHttps(src) || src);
        setImgSrc(proxiedUrl);
        return;
      }
      
      // For Google Places URLs, add cache buster
      if (isGooglePlacesImage(currentUrl)) {
        console.log("Google Places image failed, trying with cache buster:", currentUrl);
        setTimeout(() => {
          const cacheBuster = `cb=${Date.now()}`;
          setImgSrc(`${currentUrl}${currentUrl?.includes('?') ? '&' : '?'}${cacheBuster}`);
        }, 500);
        return;
      }
    }
    
    // All retries failed, use fallback
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
      crossOrigin="anonymous"
      {...props}
    />
  );
};
