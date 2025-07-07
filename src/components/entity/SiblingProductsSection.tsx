
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Entity } from '@/services/recommendation/types';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface SiblingProductsSectionProps {
  siblings: Entity[];
  parentName: string;
  currentEntityId: string;
}

export const SiblingProductsSection = ({ siblings, parentName, currentEntityId }: SiblingProductsSectionProps) => {
  // Filter out current entity and show up to 6 siblings
  const filteredSiblings = siblings
    .filter(sibling => sibling.id !== currentEntityId)
    .slice(0, 6);

  if (filteredSiblings.length === 0) {
    return null;
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          More from {parentName}
          <Badge variant="outline" className="text-xs">
            {filteredSiblings.length} more
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSiblings.map((sibling) => (
            <Link
              key={sibling.id}
              to={`/entity-v2/${sibling.slug || sibling.id}`}
              className="block group"
            >
              <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex gap-3">
                  {sibling.image_url && (
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <ImageWithFallback
                        src={sibling.image_url}
                        alt={sibling.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm group-hover:text-blue-600 transition-colors mb-1">
                      {sibling.name}
                    </h4>
                    {sibling.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {sibling.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {sibling.type}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>4.1</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        
        {siblings.length > 6 && (
          <div className="mt-4 text-center">
            <Link
              to={`/entity-v2/${parentName.toLowerCase().replace(/\s+/g, '-')}`}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View All {siblings.length} Products
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
