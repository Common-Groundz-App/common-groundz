
import React from 'react';
import { Star, MessageSquare, MapPin } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import { cn } from '@/lib/utils';

interface EntityV3HeroProps {
  entity: Entity;
  stats?: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
  isLoading?: boolean;
  className?: string;
}

export const EntityV3Hero: React.FC<EntityV3HeroProps> = ({
  entity,
  stats,
  isLoading = false,
  className
}) => {
  if (isLoading) {
    return (
      <div className={cn("col-span-full lg:col-span-8 space-y-4", className)}>
        <div className="animate-pulse">
          <div className="aspect-video bg-muted rounded-lg mb-4"></div>
          <div className="flex gap-4">
            <div className="h-6 bg-muted rounded w-20"></div>
            <div className="h-6 bg-muted rounded w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  const imageUrl = entity.image_url || entity.photo_reference;
  const hasStats = stats && (stats.recommendationCount > 0 || stats.reviewCount > 0);

  return (
    <div className={cn("col-span-full lg:col-span-8 space-y-4", className)}>
      {/* Entity Image */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={entity.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-muted-foreground text-center">
              <div className="text-4xl mb-2">📍</div>
              <p className="text-sm">No image available</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Row */}
      {hasStats && (
        <div className="flex flex-wrap items-center gap-6 text-sm">
          {stats.averageRating && stats.averageRating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{stats.averageRating.toFixed(1)}</span>
            </div>
          )}
          
          {stats.reviewCount > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>{stats.reviewCount} review{stats.reviewCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {entity.venue && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{entity.venue}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
