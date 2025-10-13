import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { getSentimentLabel } from '@/utils/ratingColorUtils';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Button } from '@/components/ui/button';
import { Entity } from '@/services/recommendation/types';
import { getEntityTypeFallbackImage, getEntityTypeLabel } from '@/services/entityTypeHelpers';

interface SiblingCarouselProps {
  siblings: Entity[];
  parentName?: string;
  onViewSibling: (sibling: Entity) => void;
}

export const SiblingCarousel: React.FC<SiblingCarouselProps> = ({
  siblings,
  parentName,
  onViewSibling
}) => {
  if (!siblings || siblings.length === 0) {
    return null;
  }

  const scrollLeft = () => {
    const container = document.getElementById('sibling-carousel');
    if (container) {
      container.scrollBy({ left: -280, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = document.getElementById('sibling-carousel');
    if (container) {
      container.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">
            {parentName ? `More from ${parentName}` : 'Related Products'}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={scrollLeft}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={scrollRight}
              className="h-8 w-8 p-0"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          id="sibling-carousel"
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {siblings.map((sibling) => (
            <div
              key={sibling.id}
              className="flex-shrink-0 w-64 p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer group"
              onClick={() => onViewSibling(sibling)}
            >
              <div className="w-full h-32 rounded-md overflow-hidden bg-muted mb-3">
                <ImageWithFallback
                  src={sibling.image_url || ''}
                  alt={sibling.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  fallbackSrc={getEntityTypeFallbackImage(sibling.type)}
                />
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm group-hover:text-foreground transition-colors">
                  {sibling.name}
                </h4>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <RatingRingIcon 
                      rating={(sibling as any).average_rating || 0} 
                      size={12} 
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {(sibling as any).average_rating 
                        ? (sibling as any).average_rating.toFixed(1) 
                        : getSentimentLabel(0)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getEntityTypeLabel(sibling.type)}
                  </Badge>
                </div>
                
                {sibling.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {sibling.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};