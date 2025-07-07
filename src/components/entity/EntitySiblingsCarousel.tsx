
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Entity } from '@/services/recommendation/types';
import { getEntityImageWithFallback } from '@/utils/entityFallbacks';
import useEmblaCarousel from 'embla-carousel-react';

interface EntitySiblingsCarouselProps {
  siblings: Entity[];
  parentEntity: Entity;
  currentEntityId: string;
  onViewSibling: (sibling: Entity) => void;
}

export const EntitySiblingsCarousel: React.FC<EntitySiblingsCarouselProps> = ({
  siblings,
  parentEntity,
  currentEntityId,
  onViewSibling,
}) => {
  const [emblaRef] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  // Filter out current entity from siblings
  const otherSiblings = siblings.filter(sibling => sibling.id !== currentEntityId);

  if (otherSiblings.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          More from {parentEntity.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="embla overflow-hidden" ref={emblaRef}>
          <div className="embla__container flex gap-4">
            {otherSiblings.map((sibling) => {
              const imageUrl = getEntityImageWithFallback(sibling, parentEntity);
              
              return (
                <div
                  key={sibling.id}
                  className="embla__slide flex-none w-48 cursor-pointer group"
                  onClick={() => onViewSibling(sibling)}
                >
                  <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors h-full">
                    <div className="aspect-square w-full rounded-md overflow-hidden bg-muted mb-3">
                      <ImageWithFallback
                        src={imageUrl}
                        alt={sibling.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        fallbackSrc={imageUrl}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm group-hover:text-foreground transition-colors line-clamp-2">
                        {sibling.name}
                      </h4>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <ConnectedRingsRating
                            value={4.1} // Mock rating - replace with actual data
                            variant="badge"
                            showValue={false}
                            size="sm"
                            minimal={true}
                          />
                          <span className="text-xs text-muted-foreground">4.1</span>
                        </div>
                        
                        <Badge variant="outline" className="text-xs capitalize">
                          {sibling.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
