
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Entity } from '@/services/recommendation/types';
import { getTopRatedChildren, getEntityImageWithFallback, getEntityDescriptionWithFallback } from '@/utils/entityFallbacks';

interface FeaturedProductsCardProps {
  children: Entity[];
  parentEntity: Entity;
  onViewChild: (child: Entity) => void;
  onViewAllProducts: () => void;
}

export const FeaturedProductsCard: React.FC<FeaturedProductsCardProps> = ({
  children,
  parentEntity,
  onViewChild,
  onViewAllProducts,
}) => {
  const featuredProducts = getTopRatedChildren(children, 3);

  if (featuredProducts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Featured Products
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAllProducts}
            className="gap-1 text-sm"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {featuredProducts.map((product) => {
            const imageUrl = getEntityImageWithFallback(product, parentEntity);
            const description = getEntityDescriptionWithFallback(product, parentEntity);
            
            return (
              <div
                key={product.id}
                className="group cursor-pointer p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => onViewChild(product)}
              >
                <div className="aspect-square w-full rounded-md overflow-hidden bg-muted mb-3">
                  <ImageWithFallback
                    src={imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    fallbackSrc={imageUrl}
                  />
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm group-hover:text-foreground transition-colors line-clamp-1">
                    {product.name}
                  </h4>
                  
                  {description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <ConnectedRingsRating
                        value={4.2} // Mock rating - replace with actual data
                        variant="badge"
                        showValue={false}
                        size="sm"
                        minimal={true}
                      />
                      <span className="text-xs text-muted-foreground">4.2</span>
                    </div>
                    
                    <Badge variant="outline" className="text-xs capitalize">
                      {product.type}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
