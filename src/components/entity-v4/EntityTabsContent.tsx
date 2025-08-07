
import React from 'react';
import { Star, Plus, MessageSquare, MessageSquareHeart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhotosSection } from './PhotosSection';
import { Entity } from '@/services/recommendation/types';
import { EntityStats } from '@/hooks/use-entity-detail-cached';
import { EntityWithChildren } from '@/services/entityHierarchyService';
import { FeaturedProductsSection } from '@/components/entity/FeaturedProductsSection';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { getEntityTypeFallbackImage } from '@/services/entityTypeMapping';

interface EntityTabsContentProps {
  entity?: Entity;
  stats?: EntityStats | null;
  entityWithChildren?: EntityWithChildren | null;
  parentEntity?: Entity | null;
  onViewChild?: (child: Entity) => void;
  onViewAllProducts?: () => void;
}

export const EntityTabsContent: React.FC<EntityTabsContentProps> = ({ 
  entity, 
  stats,
  entityWithChildren,
  parentEntity,
  onViewChild,
  onViewAllProducts
}) => {
  return (
    <Tabs defaultValue="overview" className="mb-8">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="photos">Photos & Videos</TabsTrigger>
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="posts">Posts</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6 space-y-6">
        {/* Featured Products Section */}
        {entityWithChildren?.children && entityWithChildren.children.length > 0 && onViewChild && onViewAllProducts && (
          <FeaturedProductsSection
            children={entityWithChildren.children}
            onViewChild={onViewChild}
            onViewAllProducts={onViewAllProducts}
          />
        )}

        {/* About Section */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">About {entity?.name}</h3>
            {entity?.description ? (
              <p className="text-muted-foreground leading-relaxed">{entity.description}</p>
            ) : (
              <p className="text-muted-foreground italic">No description available.</p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div>
                <h4 className="font-medium mb-2">Type</h4>
                <Badge variant="outline">{entity?.type}</Badge>
              </div>
              
              {entity?.venue && (
                <div>
                  <h4 className="font-medium mb-2">Source</h4>
                  <p className="text-sm text-muted-foreground">{entity.venue}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.reviewCount}</div>
                <p className="text-xs text-muted-foreground">Total Reviews</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.recommendationCount}</div>
                <p className="text-xs text-muted-foreground">Recommendations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {stats.averageRating ? stats.averageRating.toFixed(1) : '0.0'}
                </div>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>
      <TabsContent value="products" className="mt-6 space-y-4">
        {!entityWithChildren?.children || entityWithChildren.children.length === 0 ? (
          <div className="py-12 text-center border rounded-lg bg-blue-50/30 dark:bg-blue-900/5">
            <Plus className="h-12 w-12 mx-auto text-blue-300 dark:text-blue-700" />
            <h3 className="font-medium text-lg mt-4">No products yet</h3>
            <p className="text-muted-foreground mt-2">
              This entity doesn't have any child products or related items.
            </p>
            {parentEntity && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  This is a child product of{' '}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm font-medium"
                    onClick={() => onViewChild?.(parentEntity)}
                  >
                    {parentEntity.name}
                  </Button>
                </p>
              </div>
            )}
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>🔄 Coming Soon: Product management interface</p>
              <p>📦 Examples: Cosmix → Whey Protein, Pre-Workout, etc.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {entityWithChildren.children.length} product{entityWithChildren.children.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entityWithChildren.children.map((child) => (
                <Card 
                  key={child.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onViewChild?.(child)}
                >
                  <CardContent className="p-4">
                    {child.image_url && (
                      <div className="w-full h-32 rounded-md overflow-hidden bg-muted mb-3">
                        <ImageWithFallback
                          src={child.image_url}
                          alt={child.name}
                          className="w-full h-full object-cover"
                          fallbackSrc={getEntityTypeFallbackImage(child.type)}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <h4 className="font-medium">{child.name}</h4>
                      {child.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {child.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {child.type}
                        </Badge>
                        {child.venue && (
                          <span className="text-xs text-muted-foreground">
                            {child.venue}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </TabsContent>
      <TabsContent value="photos" className="mt-6">
        {entity && <PhotosSection entity={entity} />}
      </TabsContent>
      <TabsContent value="posts" className="mt-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Latest Posts</h3>
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h4 className="font-medium mb-2">New Product Launch: Plant-Based Protein</h4>
                <p className="text-sm text-gray-600">We're excited to announce our latest addition to the Cosmix family...</p>
                <span className="text-xs text-gray-400">2 days ago</span>
              </div>
              <div className="border-b pb-4">
                <h4 className="font-medium mb-2">The Science Behind Whey Protein</h4>
                <p className="text-sm text-gray-600">Understanding the benefits and optimal usage of whey protein...</p>
                <span className="text-xs text-gray-400">1 week ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
