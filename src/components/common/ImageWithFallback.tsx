
import React, { useState, useEffect } from 'react';
import { ensureHttps } from '@/utils/urlUtils';
import { isValidImageUrl, isGooglePlacesImage, isOpenLibraryImage, createOpenLibraryProxyUrl, getEntityTypeFallbackImage } from '@/utils/imageUtils';

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

  // Only block URLs that are known to definitely cause CORS issues (excluding OpenLibrary now)
  const shouldBlockUrl = (url: string): boolean => {
    if (!url) return true;
    
    // Block domains that are confirmed to cause CORS issues 
    // (excluding OpenLibrary since we now proxy it)
    const definitivelyBlockedDomains = [
      'googleusercontent.com'  // Always causes CORS issues
    ];
    
    const isBlocked = definitivelyBlockedDomains.some(domain => url.includes(domain));
    if (isBlocked && !suppressConsoleErrors) {
      console.log('ImageWithFallback: Blocking CORS-problematic domain:', url);
    }
    
    return isBlocked;
  };

  // Convert HTTP to HTTPS and handle special cases
  const processUrl = (url: string): string => {
    if (!url) return url;
    
    // Handle OpenLibrary images by proxying them
    if (isOpenLibraryImage(url)) {
      const proxyUrl = createOpenLibraryProxyUrl(url);
      if (!suppressConsoleErrors) {
        console.log('ImageWithFallback: Using OpenLibrary proxy for:', url, '-> proxy URL:', proxyUrl);
      }
      return proxyUrl;
    }
    
    // For other URLs, try to ensure HTTPS
    return ensureHttps(url) || url;
  };

  useEffect(() => {
    // Reset error state when src changes
    if (src) {
      setHasError(false);
      setProxyAttempted(false);
      
      if (!suppressConsoleErrors) {
        console.log('ImageWithFallback: Processing image URL:', src);
      }
      
      // Check if URL should be blocked immediately (only for truly problematic domains)
      if (shouldBlockUrl(src)) {
        if (!suppressConsoleErrors) {
          console.log("ImageWithFallback: Using fallback for blocked URL, entity type:", entityType);
        }
        setImgSrc(actualFallback);
        setHasError(true);
        return;
      }
      
      // Process the URL (convert to HTTPS if needed, or proxy if OpenLibrary)
      const processedUrl = processUrl(src);
      
      // Allow safe URLs directly (including our proxied URLs)
      if (src.includes('supabase.co/functions/v1/proxy-google-books') ||
          src.includes('supabase.co/functions/v1/proxy-google-image') || 
          src.includes('supabase.co/functions/v1/proxy-movie-image') ||
          src.includes('supabase.co/functions/v1/proxy-openlibrary') ||
          src.includes('images.unsplash.com') ||
          src.includes('supabase.co/storage/v1/object/public/') ||
          processedUrl.startsWith('https://')) {
        
        if (!suppressConsoleErrors) {
          console.log('ImageWithFallback: Using processed URL:', processedUrl);
        }
        
        // Basic URL validation
        if (!isValidImageUrl(processedUrl)) {
          if (!suppressConsoleErrors) {
            console.log("ImageWithFallback: Invalid image URL format, using fallback for entity type:", entityType);
          }
          setImgSrc(actualFallback);
          setHasError(true);
          return;
        }
        
        setImgSrc(processedUrl);
      } else {
        // For other URLs, try the processed version and let the browser handle errors
        if (!suppressConsoleErrors) {
          console.log('ImageWithFallback: Trying processed URL:', processedUrl);
        }
        setImgSrc(processedUrl);
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
      console.log('ImageWithFallback: Image load error, using fallback for type:', entityType, 'Original URL:', src);
    }
    
    // If this was an OpenLibrary proxy attempt and it failed, try direct URL once
    if (src && isOpenLibraryImage(src) && !proxyAttempted) {
      setProxyAttempted(true);
      const directUrl = ensureHttps(src);
      if (directUrl && !suppressConsoleErrors) {
        console.log('ImageWithFallback: Proxy failed, trying direct OpenLibrary URL:', directUrl);
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
