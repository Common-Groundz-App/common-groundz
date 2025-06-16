
import React, { useState, useEffect } from 'react';
import { ensureHttps } from '@/utils/urlUtils';
import { isValidImageUrl, isGooglePlacesImage, getEntityTypeFallbackImage } from '@/utils/imageUtils';

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

  // Check if URL should be immediately blocked
  const shouldBlockUrl = (url: string): boolean => {
    if (!url) return true;
    
    // Block known problematic domains that cause CORS/401 errors
    const blockedDomains = [
      'maps.googleapis.com',
      'books.google.com',
      'googleusercontent.com',
      'covers.openlibrary.org',
      'images-amazon.com',
      'm.media-amazon.com'
    ];
    
    // Block HTTP URLs (mixed content)
    if (url.startsWith('http://')) {
      if (!suppressConsoleErrors) {
        console.log('ImageWithFallback: Blocking HTTP URL (mixed content):', url);
      }
      return true;
    }
    
    // Block problematic domains
    const isBlocked = blockedDomains.some(domain => url.includes(domain));
    if (isBlocked && !suppressConsoleErrors) {
      console.log('ImageWithFallback: Blocking problematic domain:', url);
    }
    
    return isBlocked;
  };

  useEffect(() => {
    // Reset error state when src changes
    if (src) {
      setHasError(false);
      
      if (!suppressConsoleErrors) {
        console.log('ImageWithFallback: Processing image URL:', src);
      }
      
      // Check if URL should be blocked immediately
      if (shouldBlockUrl(src)) {
        if (!suppressConsoleErrors) {
          console.log("ImageWithFallback: Using fallback for blocked URL, entity type:", entityType);
        }
        setImgSrc(actualFallback);
        setHasError(true);
        return;
      }
      
      // Allow our proxy URLs and other safe URLs
      if (src.includes('supabase.co/functions/v1/proxy-google-image') || 
          src.includes('images.unsplash.com') ||
          src.includes('supabase.co/storage/v1/object/public/')) {
        if (!suppressConsoleErrors) {
          console.log('ImageWithFallback: Using safe URL:', src);
        }
        setImgSrc(src);
      } else {
        // For any other URL, validate and use HTTPS
        if (!isValidImageUrl(src)) {
          if (!suppressConsoleErrors) {
            console.log("ImageWithFallback: Invalid image URL, using fallback for entity type:", entityType);
          }
          setImgSrc(actualFallback);
          setHasError(true);
          return;
        }
        
        const secureUrl = ensureHttps(src);
        if (!secureUrl) {
          if (!suppressConsoleErrors) {
            console.log("ImageWithFallback: Using fallback image for entity type:", entityType);
          }
          setImgSrc(actualFallback);
          setHasError(true);
        } else {
          setImgSrc(secureUrl);
        }
      }
    } else {
      if (!suppressConsoleErrors) {
        console.log("ImageWithFallback: No source URL provided, using fallback for type:", entityType);
      }
      setImgSrc(actualFallback);
    }
  }, [src, actualFallback, entityType, suppressConsoleErrors]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!suppressConsoleErrors) {
      console.log('ImageWithFallback: Image load error, using fallback for type:', entityType);
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
