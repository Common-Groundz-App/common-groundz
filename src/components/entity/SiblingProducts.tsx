
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Entity } from '@/services/recommendation/types';
import { getEntityTypeFallbackImage, getEntityTypeDisplayName, mapDatabaseEntityType } from '@/services/entityTypeMapping';

interface SiblingProductsProps {
  siblings: Entity[];
  currentEntityId: string;
  parentName: string;
}

export const SiblingProducts: React.FC<SiblingProductsProps> = ({ 
  siblings, 
  currentEntityId, 
  parentName 
}) => {
  const otherSiblings = siblings.filter(sibling => sibling.id !== currentEntityId);
  
  if (otherSiblings.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4">More from {parentName}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {otherSiblings.slice(0, 8).map((sibling) => (
          <Link 
            key={sibling.id} 
            to={`/entity/${sibling.slug || sibling.id}`}
          >
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-3">
                <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2">
                  <ImageWithFallback
                    src={sibling.image_url || ''}
                    alt={sibling.name}
                    className="w-full h-full object-cover"
                    fallbackSrc={getEntityTypeFallbackImage(mapDatabaseEntityType(sibling.type as string))}
                  />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm line-clamp-2">{sibling.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {getEntityTypeDisplayName(mapDatabaseEntityType(sibling.type as string))}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
