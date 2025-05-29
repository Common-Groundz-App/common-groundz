
import React from 'react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';

interface ContentMediaThumbnailProps {
  media: MediaItem[];
  entityImageUrl?: string;
  category?: string;
  title: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const ContentMediaThumbnail: React.FC<ContentMediaThumbnailProps> = ({
  media,
  entityImageUrl,
  category,
  title,
  className,
  size = 'md'
}) => {
  const getCategoryFallbackImage = (category: string): string => {
    const fallbacks: Record<string, string> = {
      'Food': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1',
      'Drink': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87',
      'Movie': 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
      'Book': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
      'Place': 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
      'Product': 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
      'Activity': 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
      'Music': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
      'Art': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
      'TV': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
      'Travel': 'https://images.unsplash.com/photo-1501554728187-ce583db33af7'
    };
    
    return fallbacks[category] || 'https://images.unsplash.com/photo-1501854140801-50d01698950b';
  };

  const imageUrl = media.length > 0 ? media[0].url : entityImageUrl;
  const fallbackUrl = category ? getCategoryFallbackImage(category) : undefined;

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20'
  };

  if (!imageUrl && !fallbackUrl) {
    return null;
  }

  return (
    <div className={cn("flex-shrink-0 rounded-lg overflow-hidden", sizeClasses[size], className)}>
      <ImageWithFallback
        src={imageUrl || ''}
        alt={title}
        className="w-full h-full object-cover"
        fallbackSrc={fallbackUrl}
      />
    </div>
  );
};
