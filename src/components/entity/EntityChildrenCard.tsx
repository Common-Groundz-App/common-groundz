
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight, Package, Star } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Entity } from '@/services/recommendation/types';
import { getEntityImageWithFallback, getEntityDescriptionWithFallback, getEntitySpecSummary, isEntityPopular } from '@/utils/entityFallbacks';

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
              <div key={i} className="h-20 bg-muted rounded-md"></div>
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
        {children.slice(0, 8).map((child: Entity) => {
          const imageUrl = getEntityImageWithFallback(child, parentEntity);
          const description = getEntityDescriptionWithFallback(child, parentEntity);
          const specSummary = getEntitySpecSummary(child);
          const isPopular = isEntityPopular(child);
          
          return (
            <div 
              key={child.id} 
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={() => onViewChild?.(child)}
            >
              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <ImageWithFallback
                  src={imageUrl}
                  alt={child.name}
                  className="w-full h-full object-cover"
                  fallbackSrc={imageUrl}
                />
              </div>
              
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm truncate group-hover:text-foreground transition-colors">
                    {child.name}
                  </div>
                  {isPopular && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Star className="h-3 w-3" />
                      Popular
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <ConnectedRingsRating
                      value={4.3} // Mock rating - replace with actual data
                      variant="badge"
                      showValue={false}
                      size="sm"
                      minimal={true}
                    />
                    <span className="text-xs text-muted-foreground">4.3</span>
                  </div>
                  
                  <Badge variant="outline" className="text-xs capitalize">
                    {child.type}
                  </Badge>
                  
                  {child.venue && (
                    <span className="text-xs text-muted-foreground truncate">
                      {child.venue}
                    </span>
                  )}
                </div>
                
                {specSummary && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {specSummary}
                  </p>
                )}
                
                {description && !specSummary && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {description}
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
          );
        })}
        
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
