
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ExternalLink } from 'lucide-react';
import { useEntityProducts } from '@/hooks/use-entity-products';
import { EntityProduct } from '@/services/entityProductService';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface EntityProductsCardProps {
  entityId: string;
  entityName: string;
}

export const EntityProductsCard: React.FC<EntityProductsCardProps> = ({ 
  entityId, 
  entityName 
}) => {
  const { products, isLoading, error } = useEntityProducts(entityId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded-md"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Products</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load products
          </p>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No products yet for {entityName}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Products ({products.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.slice(0, 5).map((product: EntityProduct) => (
          <div key={product.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50 transition-colors">
            {product.image_url && (
              <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <ImageWithFallback
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {product.name}
              </div>
              {product.price && (
                <Badge variant="outline" className="text-xs mt-1">
                  {product.price}
                </Badge>
              )}
            </div>
            
            {product.buy_link && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={() => window.open(product.buy_link, '_blank')}
              >
                <ExternalLink className="h-3 w-3" />
                <span className="sr-only">View product</span>
              </Button>
            )}
          </div>
        ))}
        
        {products.length > 5 && (
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" className="text-xs">
              View all {products.length} products
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
