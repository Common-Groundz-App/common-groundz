
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight, Package } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Entity } from '@/services/recommendation/types';
import { getEntityTypeFallbackImage, getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { getOptimalEntityImageUrl } from '@/utils/entityImageUtils';

interface EntityChildrenCardProps {
  children: Entity[];
  parentName: string;
  parentEntity?: Entity;
  isLoading?: boolean;
  onViewChild?: (child: Entity) => void;
  onAddChild?: () => void;
  canAddChildren?: boolean;
}

export const EntityChildrenCard: React.FC<EntityChildrenCardProps> = ({
  children,
  parentName,
  parentEntity,
  isLoading = false,
  onViewChild,
  onAddChild,
  canAddChildren = false
}) => {
  // Helper function to get fallback image using parent if needed - now uses optimal URL helper
  const getChildImage = (child: Entity) => {
    const optimalUrl = getOptimalEntityImageUrl(child);
    if (optimalUrl) return optimalUrl;
    const parentOptimalUrl = getOptimalEntityImageUrl(parentEntity);
    if (parentOptimalUrl) return parentOptimalUrl;
    return getEntityTypeFallbackImage(child.type);
  };

  // Helper function to get fallback description using parent if needed
  const getChildDescription = (child: Entity) => {
    if (child.description) return child.description;
    if (parentEntity?.description) return `${parentEntity.description} - ${child.name}`;
    return null;
  };

  // Helper function to create spec summary
  const getSpecSummary = (child: Entity) => {
    const specs = child.specifications || {};
    const price = child.price_info;
    const parts = [];
    
    if (specs.brand) parts.push(specs.brand);
    if (specs.size) parts.push(specs.size);
    if (specs.weight) parts.push(specs.weight);
    if (price?.amount && price?.currency) parts.push(`${price.currency}${price.amount}`);
    
    return parts.length > 0 ? parts.slice(0, 3).join(', ') : null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Related Products
          </CardTitle>
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

  if (children.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Related Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h4 className="font-medium text-sm mb-1">No related products yet</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Add related products or variants for {parentName}
            </p>
            {canAddChildren && (
              <Button 
                onClick={onAddChild}
                size="sm" 
                variant="outline" 
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Related Products ({children.length})
          </CardTitle>
          {canAddChildren && (
            <Button 
              onClick={onAddChild}
              size="sm" 
              variant="ghost" 
              className="h-7 px-2 text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {children.slice(0, 8).map((child: Entity, index: number) => (
          <div 
            key={child.id} 
            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
            onClick={() => onViewChild?.(child)}
          >
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
              <ImageWithFallback
                src={getChildImage(child)}
                alt={child.name}
                className="w-full h-full object-cover"
                fallbackSrc={getEntityTypeFallbackImage(child.type)}
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-medium text-sm truncate group-hover:text-foreground transition-colors">
                  {child.name}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <RatingRingIcon 
                    rating={child.average_rating || 0} 
                    size={12} 
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {child.average_rating 
                      ? child.average_rating.toFixed(1) 
                      : 'No ratings'}
                  </span>
                  {child.review_count !== undefined && child.review_count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({child.review_count})
                    </span>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {getEntityTypeLabel(child.type)}
                </Badge>
                {child.venue && (
                  <span className="text-xs text-muted-foreground truncate">
                    {child.venue}
                  </span>
                )}
              </div>
              
              {getSpecSummary(child) && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {getSpecSummary(child)}
                </p>
              )}
              
              {getChildDescription(child) && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {getChildDescription(child)}
                </p>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ArrowRight className="h-3 w-3" />
              <span className="sr-only">View {child.name}</span>
            </Button>
          </div>
        ))}
        
        {children.length > 8 && (
          <div className="text-center pt-2 border-t">
            <Button variant="ghost" size="sm" className="text-xs">
              View all {children.length} products
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
