
import React, { useState } from 'react';
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
  const [imgSrc, setImgSrc] = useState(ensureHttps(src || ''));
  const [hasError, setHasError] = useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    }
    if (onError) {
      onError(e);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={handleError}
      {...props}
    />
  );
};

