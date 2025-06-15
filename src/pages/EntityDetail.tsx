import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useEntityDetail } from '@/hooks/use-entity-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge";
import ReviewCard from '@/components/profile/reviews/ReviewCard';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import { useRecommendations } from '@/hooks/use-recommendations';
import { Skeleton } from "@/components/ui/skeleton"
import { ProfileDisplay } from '@/components/common/ProfileDisplay';
import { ScrollArea } from "@/components/ui/scroll-area"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ensureHttps } from '@/utils/urlUtils';
import { Card, CardContent } from "@/components/ui/card";
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Separator } from "@/components/ui/separator";
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

const EntityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const {
    entity,
    recommendations,
    reviews,
    stats,
    isLoading,
    error,
    refreshData
  } = useEntityDetail(slug as string);
  
  const { handleLike: handleLikeRecommendation, handleSave: handleSaveRecommendation } = useRecommendations();
  
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [dynamicReviews, setDynamicReviews] = useState<any[]>([]);
  const [dynamicReviewsCount, setDynamicReviewsCount] = useState(0);

  useEffect(() => {
    if (reviews) {
      // Filter reviews that have a timeline
      const timelineReviews = reviews.filter(review => review.has_timeline);
      setDynamicReviews(timelineReviews);
      setDynamicReviewsCount(timelineReviews.length);
    }
  }, [reviews]);

  const tabs = [
    { 
      id: 'overview', 
      label: 'Overview', 
      count: null 
    },
    { 
      id: 'recommendations', 
      label: 'Recommendations', 
      count: stats.recommendationCount 
    },
    { 
      id: 'reviews', 
      label: 'All Reviews', 
      count: stats.reviewCount 
    },
    { 
      id: 'dynamic-reviews', 
      label: 'Dynamic Reviews', 
      count: dynamicReviewsCount 
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </div>

          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => (
              <Skeleton key={tab.id} className="h-10 w-full" />
            ))}
          </TabsList>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!entity || error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Error</h2>
            <p className="text-muted-foreground">
              {error || 'Failed to load entity details.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{entity.name}</h1>
          <p className="text-muted-foreground">
            {entity.description || 'No description available.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div>
                  <h3 className="text-lg font-semibold">Rating</h3>
                  <div className="flex items-center space-x-2">
                    <ConnectedRingsRating
                      value={stats.averageRating || 0}
                      size="md"
                      variant="default"
                      showValue={false}
                      isInteractive={false}
                      showLabel={false}
                    />
                    <span>{stats.averageRating ? stats.averageRating.toFixed(1) : 'No ratings'}</span>
                  </div>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <h3 className="text-lg font-semibold">Type</h3>
                  <p>{entity.type || 'Unknown'}</p>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <h3 className="text-lg font-semibold">Location</h3>
                  <p>{entity.venue || 'Unknown'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div>
                  <h3 className="text-lg font-semibold">Recommendations</h3>
                  <p>{stats.recommendationCount}</p>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <h3 className="text-lg font-semibold">Reviews</h3>
                  <p>{stats.reviewCount}</p>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <h3 className="text-lg font-semibold">Created</h3>
                  <div className="text-xs text-gray-500 flex items-center mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>{entity.created_at ? format(new Date(entity.created_at), 'MMM d, yyyy') : 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="flex items-center gap-2"
              >
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {tab.count}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Overview</h2>
                <p className="text-muted-foreground">
                  Learn more about {entity.name}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <h3 className="text-lg font-semibold">Description</h3>
                  <p className="text-sm text-muted-foreground">{entity.description}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <h3 className="text-lg font-semibold">Additional Information</h3>
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Type:</strong> {entity.type}</p>
                    <p><strong>Location:</strong> {entity.venue || 'Unknown'}</p>
                    {entity.website_url && (
                      <p>
                        <strong>Website:</strong>
                        <a href={entity.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Visit Website
                        </a>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <h3 className="text-lg font-semibold">Media</h3>
                  {entity.image_url ? (
                    <AspectRatio ratio={16 / 9}>
                      <ImageWithFallback
                        src={ensureHttps(entity.image_url)}
                        alt={entity.name}
                        className="object-cover rounded-md"
                      />
                    </AspectRatio>
                  ) : (
                    <p className="text-sm text-muted-foreground">No media available.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Recommendations</h2>
                <p className="text-muted-foreground">
                  See what people are recommending about {entity.name}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map(recommendation => (
                <RecommendationCard 
                  key={recommendation.id}
                  recommendation={recommendation}
                  onLike={handleLikeRecommendation}
                  onSave={handleSaveRecommendation}
                  hideEntityFallbacks={true}
                  compact={true}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">All Reviews</h2>
                <p className="text-muted-foreground">
                  See what everyone is saying about {entity.name}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map(review => (
                <ReviewCard 
                  key={review.id}
                  review={review}
                  onLike={() => {}}
                  onSave={() => {}}
                  refreshReviews={refreshData}
                  hideEntityFallbacks={true}
                  compact={true}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="dynamic-reviews" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Dynamic Reviews</h2>
                <p className="text-muted-foreground">
                  Dynamic Reviews track how experiences evolve over time
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dynamicReviews.map(review => (
                <ReviewCard 
                  key={review.id}
                  review={review}
                  onLike={() => {}}
                  onSave={() => {}}
                  refreshReviews={refreshData}
                  hideEntityFallbacks={true}
                  compact={true}
                  showTimelineFeatures={true}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EntityDetail;
