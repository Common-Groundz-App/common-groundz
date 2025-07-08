import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Entity } from '@/services/recommendation/types';
import { getEntityTypeFallbackImage } from '@/services/entityTypeMapping';

interface FeaturedProductsSectionProps {
  children: Entity[];
  onViewChild: (child: Entity) => void;
  onViewAllProducts: () => void;
}

export const FeaturedProductsSection: React.FC<FeaturedProductsSectionProps> = ({
  children,
  onViewChild,
  onViewAllProducts
}) => {
  if (!children || children.length === 0) {
    return null;
  }

  // Get top 4 featured products (for now just take first 4, later can add rating logic)
  const featuredProducts = children.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Featured Products</CardTitle>
          {children.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewAllProducts}
              className="text-xs gap-1"
            >
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {featuredProducts.map((child) => (
            <div
              key={child.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={() => onViewChild(child)}
            >
              <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <ImageWithFallback
                  src={child.image_url || ''}
                  alt={child.name}
                  className="w-full h-full object-cover"
                  fallbackSrc={getEntityTypeFallbackImage(child.type)}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate group-hover:text-foreground transition-colors">
                  {child.name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">4.5</span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {child.type}
                  </Badge>
                </div>
                {child.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {child.description}
                  </p>
                )}
              </div>
              
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
        
        {children.length > 4 && (
          <Button
            variant="outline"
            onClick={onViewAllProducts}
            className="w-full gap-2"
          >
            View All {children.length} Products
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};