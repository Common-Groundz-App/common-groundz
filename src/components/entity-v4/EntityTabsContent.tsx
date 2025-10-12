
import React, { useState, useEffect, useRef } from 'react';
import { Star, Plus, MessageSquare, MessageSquareHeart } from "lucide-react";
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
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
import { getEntityTypeFallbackImage } from '@/services/entityTypeHelpers';
import { getEntityStats } from '@/services/entityService';
import PostFeedItem from '@/components/feed/PostFeedItem';
import { useEntityPosts } from '@/hooks/use-entity-posts';

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
  const [childrenStats, setChildrenStats] = useState<Record<string, EntityStats>>({});
  
  // Refs for scroll management
  const tablistRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Fetch stats for child entities
  useEffect(() => {
    const fetchChildrenStats = async () => {
      if (!entityWithChildren?.children?.length) return;
      
      const statsPromises = entityWithChildren.children.map(async (child) => {
        try {
          const childStats = await getEntityStats(child.id, null);
          return { id: child.id, stats: childStats };
        } catch (error) {
          console.error(`Error fetching stats for child ${child.id}:`, error);
          return { id: child.id, stats: null };
        }
      });

      const results = await Promise.all(statsPromises);
      const statsMap = results.reduce((acc, { id, stats }) => {
        if (stats) {
          acc[id] = stats;
        }
        return acc;
      }, {} as Record<string, EntityStats>);

      setChildrenStats(statsMap);
    };

    fetchChildrenStats();
  }, [entityWithChildren?.children]);

  const { items: posts, isLoading: postsLoading, hasMore, fetchFirst, fetchNext, reset } = useEntityPosts(entity?.id);

  useEffect(() => {
    if (!entity?.id) return;
    reset();
    fetchFirst();
  }, [entity?.id]);

  // Ensure first tab is visible on mount
  useEffect(() => {
    if (tablistRef.current) {
      tablistRef.current.scrollLeft = 0;
    }
  }, []);

  // Removed conflicting scroll management that interferes with child components
  return (
    <Tabs defaultValue="overview" className="mb-8">
      <TabsList 
        ref={tablistRef}
        className="relative flex overflow-x-auto overflow-y-hidden scrollbar-hide w-full bg-transparent border-b border-border min-h-[48px]"
      >
        <TabsTrigger 
          value="overview"
          ref={activeTabRef}
          className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger 
          value="photos"
          className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center"
        >
          Photos & Videos
        </TabsTrigger>
        <TabsTrigger 
          value="products"
          className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center"
        >
          <span className="flex items-center gap-2">
            Products
            {entityWithChildren?.children && entityWithChildren.children.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5">
                {entityWithChildren.children.length}
              </Badge>
            )}
          </span>
        </TabsTrigger>
        <TabsTrigger 
          value="posts"
          className="flex-shrink-0 whitespace-nowrap border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium transition-all hover:border-brand-orange/50 data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none snap-start min-h-[48px] flex items-center justify-center"
        >
          <span className="flex items-center gap-2">
            Posts
            {posts.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5">
                {posts.length}
              </Badge>
            )}
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6 space-y-6">
        {/* Featured Products Section */}
        {entityWithChildren?.children && entityWithChildren.children.length > 0 && onViewChild && onViewAllProducts && (
          <FeaturedProductsSection
            children={entityWithChildren.children}
            childrenStats={childrenStats}
            onViewChild={onViewChild}
            onViewAllProducts={onViewAllProducts}
          />
        )}

        {/* About Section */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">About {entity?.name}</h3>
            <div className="space-y-3">
              {entity?.description ? (
                <>
                  <div className="text-muted-foreground leading-relaxed">
                    <RichTextDisplay content={entity.description} />
                  </div>
                  {/* Attribution for Google-sourced descriptions */}
                  {(entity as any).about_source === 'google_editorial' && (
                    <p className="text-xs text-muted-foreground italic">
                      Source: Google
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground italic">No description available.</p>
              )}
            </div>
            
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
        <div className="space-y-4">
          {posts.length === 0 && !postsLoading ? (
            <div className="py-12 text-center border rounded-lg bg-green-50/30 dark:bg-green-900/5">
              <MessageSquare className="h-12 w-12 mx-auto text-green-300 dark:text-green-700" />
              <h3 className="font-medium text-lg mt-4">No posts yet</h3>
              <p className="text-muted-foreground mt-2">
                Social posts tagged with this entity will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostFeedItem key={p.id} post={p} />
              ))}
            </div>
          )}
          <div className="flex justify-center pt-2">
            {hasMore && (
              <Button variant="outline" size="sm" onClick={fetchNext} disabled={postsLoading}>
                {postsLoading ? 'Loading...' : 'Load more'}
              </Button>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};
