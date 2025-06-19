
import React, { useState, useEffect } from 'react';
import { ProgressiveImage } from '@/components/ui/progressive-image';
import { ensureHttps } from '@/utils/urlUtils';
import { isValidImageUrl, getEntityTypeFallbackImage } from '@/utils/imageUtils';

interface EnhancedImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  entityType?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  suppressConsoleErrors?: boolean;
  showProgressiveLoading?: boolean;
}

export const EnhancedImageWithFallback: React.FC<EnhancedImageWithFallbackProps> = ({ 
  src, 
  fallbackSrc,
  entityType,
  alt,
  onError,
  suppressConsoleErrors = false,
  showProgressiveLoading = true,
  ...props 
}) => {
  const typeFallback = entityType ? getEntityTypeFallbackImage(entityType) : undefined;
  const actualFallback = fallbackSrc || typeFallback || 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07';
  
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);

  const shouldBlockUrl = (url: string): boolean => {
    if (!url) return true;
    
    const definitivelyBlockedDomains = [
      'googleusercontent.com',
      'covers.openlibrary.org'
    ];
    
    const isBlocked = definitivelyBlockedDomains.some(domain => url.includes(domain));
    if (isBlocked && !suppressConsoleErrors) {
      console.log('EnhancedImageWithFallback: Blocking CORS-problematic domain:', url);
    }
    
    return isBlocked;
  };

  const processUrl = (url: string): string => {
    if (!url) return url;
    return ensureHttps(url) || url;
  };

  useEffect(() => {
    if (src) {
      if (!suppressConsoleErrors) {
        console.log('EnhancedImageWithFallback: Processing image URL:', src);
      }
      
      if (shouldBlockUrl(src)) {
        if (!suppressConsoleErrors) {
          console.log("EnhancedImageWithFallback: Using fallback for blocked URL, entity type:", entityType);
        }
        setProcessedSrc(actualFallback);
        return;
      }
      
      const processedUrl = processUrl(src);
      
      if (src.includes('supabase.co/functions/v1/proxy-google-books') ||
          src.includes('supabase.co/functions/v1/proxy-google-image') || 
          src.includes('supabase.co/functions/v1/proxy-movie-image') ||
          src.includes('images.unsplash.com') ||
          src.includes('supabase.co/storage/v1/object/public/') ||
          processedUrl.startsWith('https://')) {
        
        if (!isValidImageUrl(processedUrl)) {
          if (!suppressConsoleErrors) {
            console.log("EnhancedImageWithFallback: Invalid image URL format, using fallback for entity type:", entityType);
          }
          setProcessedSrc(actualFallback);
          return;
        }
        
        setProcessedSrc(processedUrl);
      } else {
        if (!suppressConsoleErrors) {
          console.log('EnhancedImageWithFallback: Trying processed URL:', processedUrl);
        }
        setProcessedSrc(processedUrl);
      }
    } else {
      if (!suppressConsoleErrors) {
        console.log("EnhancedImageWithFallback: No source URL provided, using fallback for type:", entityType);
      }
      setProcessedSrc(actualFallback);
    }
  }, [src, actualFallback, entityType, suppressConsoleErrors]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!suppressConsoleErrors) {
      console.log('EnhancedImageWithFallback: Image load error, using fallback for type:', entityType, 'Original URL:', src);
    }
    
    setProcessedSrc(actualFallback);
    
    if (onError) {
      onError(e);
    }
  };

  if (showProgressiveLoading && processedSrc) {
    return (
      <ProgressiveImage
        src={processedSrc}
        alt={alt || ''}
        onError={handleError}
        placeholder={actualFallback}
        {...props}
      />
    );
  }

  return (
    <img
      src={processedSrc || actualFallback}
      alt={alt}
      onError={handleError}
      crossOrigin="anonymous"
      {...props}
    />
  );
};
