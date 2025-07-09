
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { MessageSquare, Star, Info, BarChart3 } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import { EntityV3ReviewCard } from './EntityV3ReviewCard';
import { EntityV3ReviewFilters } from './EntityV3ReviewFilters';
import { EntityV3RatingBreakdown } from './EntityV3RatingBreakdown';
import { EntityV3RecommendationCard } from './EntityV3RecommendationCard';
import { EntityV3OverviewSection } from './EntityV3OverviewSection';
import { useReviews } from '@/hooks/use-reviews';
import { useRecommendations } from '@/hooks/use-recommendations';

interface EntityV3ContentProps {
  entity: Entity;
  recommendations: any[];
  reviews: any[];
}

interface FilterOptions {
  rating?: number[];
  verified?: boolean;
  hasTimeline?: boolean;
  dateRange?: string;
  categories?: string[];
}

export const EntityV3Content: React.FC<EntityV3ContentProps> = ({ 
  entity, 
  recommendations, 
  reviews 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate stats
  const stats = useMemo(() => {
    const reviewCount = reviews.length;
    const recommendationCount = recommendations.length;
    const averageRating = reviewCount > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount 
      : null;
    
    return {
      reviewCount,
      recommendationCount,
      averageRating
    };
  }, [reviews, recommendations]);

  // Calculate rating distribution
  const ratingDistribution = useMemo(() => {
    const distribution = [5, 4, 3, 2, 1].map(rating => ({
      rating,
      count: reviews.filter(review => review.rating === rating).length,
      percentage: 0
    }));

    const totalReviews = reviews.length;
    distribution.forEach(item => {
      item.percentage = totalReviews > 0 ? (item.count / totalReviews) * 100 : 0;
    });

    return distribution;
  }, [reviews]);

  // Filter and sort reviews
  const filteredReviews = useMemo(() => {
    let filtered = [...reviews];

    // Apply filters
    if (filters.rating?.length) {
      filtered = filtered.filter(review => filters.rating!.includes(review.rating));
    }
    if (filters.verified) {
      filtered = filtered.filter(review => review.is_verified);
    }
    if (filters.hasTimeline) {
      filtered = filtered.filter(review => review.has_timeline);
    }
    if (filters.categories?.length) {
      filtered = filtered.filter(review => filters.categories!.includes(review.category));
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(review => 
        review.title?.toLowerCase().includes(query) ||
        review.description?.toLowerCase().includes(query) ||
        review.user?.username?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        case 'helpful':
          return (b.likes || 0) - (a.likes || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [reviews, filters, sortBy, searchQuery]);

  // Get available categories
  const availableCategories = useMemo(() => {
    return [...new Set(reviews.map(review => review.category))];
  }, [reviews]);

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setSortBy('newest');
  };

  const tabItems = [
    {
      value: 'overview',
      label: 'Overview',
      icon: Info
    },
    {
      value: 'reviews',
      label: `Reviews (${reviews.length})`,
      icon: MessageSquare
    },
    {
      value: 'recommendations',
      label: `Recommendations (${recommendations.length})`,
      icon: Star
    },
    {
      value: 'analytics',
      label: 'Analytics',
      icon: BarChart3
    }
  ];

  return (
    <div className="lg:col-span-1 space-y-6">
      <Card>
        <CardContent className="p-6">
          <TubelightTabs 
            defaultValue="overview" 
            items={tabItems}
            onValueChange={setActiveTab}
          >
            <TabsContent value="overview" className="mt-6">
              <EntityV3OverviewSection 
                entity={entity} 
                stats={stats}
              />
            </TabsContent>
            
            <TabsContent value="reviews" className="mt-6">
              <div className="space-y-6">
                <EntityV3ReviewFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  availableCategories={availableCategories}
                  totalResults={filteredReviews.length}
                  onClearFilters={clearFilters}
                />

                {filteredReviews.length > 0 ? (
                  <div className="space-y-4">
                    {filteredReviews.map(review => (
                      <EntityV3ReviewCard 
                        key={review.id}
                        review={review}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No reviews found
                    </h3>
                    <p className="text-muted-foreground">
                      {reviews.length === 0 
                        ? "Be the first to share your experience!" 
                        : "Try adjusting your filters to see more results."
                      }
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="recommendations" className="mt-6">
              <div className="space-y-4">
                {recommendations.length > 0 ? (
                  recommendations.map(recommendation => (
                    <EntityV3RecommendationCard 
                      key={recommendation.id}
                      recommendation={recommendation}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No recommendations yet
                    </h3>
                    <p className="text-muted-foreground">
                      Be the first to recommend this!
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              {reviews.length > 0 ? (
                <EntityV3RatingBreakdown
                  averageRating={stats.averageRating || 0}
                  totalReviews={stats.reviewCount}
                  ratingDistribution={ratingDistribution}
                  trustScore={1.8}
                  verifiedPercentage={Math.round((reviews.filter(r => r.is_verified).length / reviews.length) * 100)}
                />
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No analytics available
                  </h3>
                  <p className="text-muted-foreground">
                    Analytics will appear once there are reviews to analyze.
                  </p>
                </div>
              )}
            </TabsContent>
          </TubelightTabs>
        </CardContent>
      </Card>
    </div>
  );
};
