
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Entity } from '@/services/recommendation/types';

interface EntityChildrenCardProps {
  children: Entity[];
  parentName: string;
  isLoading?: boolean;
  onViewChild?: (child: Entity) => void;
}

export const EntityChildrenCard: React.FC<EntityChildrenCardProps> = ({
  children,
  parentName,
  isLoading = false,
  onViewChild
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Related Products</CardTitle>
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
        <CardHeader>
          <CardTitle className="text-sm font-medium">Related Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No related products yet for {parentName}
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
          Related Products ({children.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {children.slice(0, 5).map((child: Entity) => (
          <div 
            key={child.id} 
            className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => onViewChild?.(child)}
          >
            {child.image_url && (
              <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <ImageWithFallback
                  src={child.image_url}
                  alt={child.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {child.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {child.type}
                </Badge>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <ArrowRight className="h-3 w-3" />
              <span className="sr-only">View {child.name}</span>
            </Button>
          </div>
        ))}
        
        {children.length > 5 && (
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" className="text-xs">
              View all {children.length} products
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
