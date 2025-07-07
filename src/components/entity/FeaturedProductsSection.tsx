
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Entity } from '@/services/recommendation/types';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface FeaturedProductsSectionProps {
  children: Entity[];
  parentName: string;
  onViewAll: () => void;
}

export const FeaturedProductsSection = ({ children, parentName, onViewAll }: FeaturedProductsSectionProps) => {
  // Show top 4 products (or all if less than 4)
  const featuredProducts = children.slice(0, 4);

  if (featuredProducts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Featured Products</CardTitle>
          {children.length > 4 && (
            <Button variant="outline" size="sm" onClick={onViewAll} className="gap-1">
              View All {children.length}
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredProducts.map((product) => (
            <Link
              key={product.id}
              to={`/entity-v2/${product.slug || product.id}`}
              className="block group"
            >
              <div className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                {product.image_url && (
                  <div className="w-full h-24 rounded-md overflow-hidden bg-muted mb-2">
                    <ImageWithFallback
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <h4 className="font-medium text-sm group-hover:text-blue-600 transition-colors">
                    {product.name}
                  </h4>
                  {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {product.type}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>4.2</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
