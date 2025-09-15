import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, MessageSquare, MessageSquareHeart, Plus, Share2, Flag, RefreshCw, Image, Info } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import { useEntityDetail } from '@/hooks/use-entity-detail';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { useAuth } from '@/contexts/AuthContext';
import NotFound from './NotFound';
import ReviewCard from '@/components/profile/reviews/ReviewCard';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useToast } from '@/hooks/use-toast';
import RecommendationForm from '@/components/recommendations/RecommendationForm';
import ReviewForm from '@/components/profile/reviews/ReviewForm';
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { DynamicReviewsSummary } from '@/components/profile/reviews/DynamicReviewsSummary';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { CircleContributorsPreview } from '@/components/recommendations/CircleContributorsPreview';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { useEntityTimelineSummary } from '@/hooks/use-entity-timeline-summary';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { MediaItem } from '@/types/media';
import { getSentimentColor } from '@/utils/ratingColorUtils';
import { EntityMetadataCard } from '@/components/entity/EntityMetadataCard';
import { EntitySpecsCard } from '@/components/entity/EntitySpecsCard';
import { EntityRelatedCard } from '@/components/entity/EntityRelatedCard';
import { EntityDetailLoadingProgress } from '@/components/ui/entity-detail-loading-progress';
import { EntityDetailSkeleton } from '@/components/entity/EntityDetailSkeleton';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';
import { Eye, ArrowRight } from 'lucide-react';
import { mapEntityTypeToDatabase, getContextualFieldLabel, getEntityTypeFallbackImage } from '@/services/entityTypeMapping';
import { EntityType } from '@/services/recommendation/types';
import { Helmet } from 'react-helmet-async';
import { getEntityUrl, isUUID } from '@/utils/entityUrlUtils';

import EntityDetailV2 from './EntityDetailV2';

const EntityDetailOriginal = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('reviews');
  const { handleImageUpload } = useRecommendationUploads();

  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [timelineReviewId, setTimelineReviewId] = useState<string | null>(null);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);

  const { refreshEntityImage, isRefreshing, isEntityImageMigrated } = useEntityImageRefresh();

  const {
    entity,
    recommendations,
    reviews,
    stats,
    isLoading,
    loadingStep,
    error,
    refreshData
  } = useEntityDetail(slug || '');

  // Canonical redirect: if URL contains UUID instead of slug, redirect to slug-based URL
  useEffect(() => {
    if (entity && slug && isUUID(slug) && entity.slug) {
      navigate(getEntityUrl(entity), { replace: true });
    }
  }, [entity, slug, navigate]);

  const {
    circleRating,
    circleRatingCount,
    circleContributors,
    isLoading: isCircleRatingLoading
  } = useCircleRating(entity?.id || '');

  const dynamicReviews = React.useMemo(() => {
    if (!reviews) return [];
    return reviews.filter(review => review.has_timeline && review.timeline_count && review.timeline_count > 0);
  }, [reviews]);

  const { summary: timelineData, isLoading: isTimelineLoading, error: timelineError } = useEntityTimelineSummary(entity?.id || null);

  const allReviews = React.useMemo(() => {
    if (!reviews) return [];
    return reviews;
  }, [reviews]);

  const userReview = React.useMemo(() => {
    if (!user || !reviews) return null;
    return reviews.find(review => review.user_id === user.id);
  }, [user, reviews]);

  const getSidebarButtonConfig = () => {
    if (!userReview) {
      return {
        text: 'Write Review',
        icon: MessageSquare,
        action: handleAddReview,
        tooltip: null
      };
    }

    if (userReview.has_timeline && userReview.timeline_count && userReview.timeline_count > 0) {
      return {
        text: 'Add Timeline Update',
        icon: MessageSquare,
        action: () => handleStartTimeline(userReview.id),
        tooltip: 'Continue tracking how your experience evolves'
      };
    }

    return {
      text: 'Update Your Review',
      icon: MessageSquare,
      action: () => handleStartTimeline(userReview.id),
      tooltip: 'Already reviewed this? Add how it\'s going now.'
    };
  };

  useEffect(() => {
    if (!isLoading) {
      console.log('EntityDetail component received recommendations:', recommendations?.length);
      console.log('EntityDetail component received reviews:', reviews?.length);
      console.log('Dynamic reviews:', dynamicReviews.length);
      console.log('Static reviews:', allReviews.length);
      console.log('User review:', userReview);
      if (recommendations?.length > 0) {
        console.log('Sample recommendation:', recommendations[0]);
      }
      if (reviews?.length > 0) {
        console.log('Sample review:', reviews[0]);
      }
    }
  }, [isLoading, recommendations, reviews, dynamicReviews, allReviews, userReview]);

  useEffect(() => {
    if (circleContributors.length > 0) {
      console.log('Contributors ready for display:', circleContributors);
    }
  }, [circleContributors]);

  if (!isLoading && (error || !entity)) {
    return <NotFound />;
  }

  if (isLoading && loadingStep > 0) {
    return (
      <div className="min-h-screen flex flex-col animate-fade-in">
        <NavBarComponent />
        <div className="flex-1 pt-16">
          <div className="container max-w-6xl mx-auto py-8 px-4">
            <EntityDetailLoadingProgress 
              entityName={slug || 'Entity'}
              entityType="product"
            />
          </div>
        </div>
        <Footer />
        <BottomNavigation />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col animate-fade-in">
        <NavBarComponent />
        <div className="flex-1 pt-16">
          <EntityDetailSkeleton />
        </div>
        <Footer />
        <BottomNavigation />
      </div>
    );
  }

  const getContextualFieldInfo = () => {
    if (!entity) return null;

    // Use mapped type for switch statement
    const mappedType = mapEntityTypeToDatabase(entity.type);
    const label = getContextualFieldLabel(entity.type);

    switch (mappedType) {
      case EntityType.Book:
        return {
          label,
          value: entity.authors && entity.authors.length > 0 
            ? entity.authors[0] 
            : entity.venue || null
        };
      case EntityType.Movie:
        return {
          label,
          value: entity.cast_crew?.studio || entity.venue || null
        };
      case EntityType.Place:
        return {
          label,
          value: entity.api_source === 'google_places' && entity.metadata?.formatted_address
            ? entity.metadata.formatted_address
            : entity.venue || null
        };
      case EntityType.Product:
        return {
          label,
          value: entity.specifications?.brand || entity.venue || null
        };
      case EntityType.Product: // Updated from EntityType.Food
        return {
          label,
          value: entity.venue || null
        };
      default:
        return {
          label: 'Source',
          value: entity.venue || null
        };
    }
  };

  const contextualField = getContextualFieldInfo();

  const handleAddRecommendation = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add a recommendation",
        variant: "destructive",
      });
      return;
    }

    setIsRecommendationFormOpen(true);
  };

  const handleAddReview = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add a review",
        variant: "destructive",
      });
      return;
    }

    setIsReviewFormOpen(true);
  };

  const handleStartTimeline = (reviewId: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to start a timeline",
        variant: "destructive",
      });
      return;
    }

    setTimelineReviewId(reviewId);
    setIsTimelineViewerOpen(true);
  };

  const handleRecommendationAction = (action: string, id: string) => {
    console.log(`Recommendation ${action} action for ${id}`);
    refreshData();
  };

  const handleReviewAction = (action: string, id: string) => {
    console.log(`Review ${action} action for ${id}`);
    refreshData();
  };

  const handleRecommendationSubmit = async (values: any) => {
    try {
      toast({
        title: "Recommendation added",
        description: "Your recommendation has been added successfully"
      });

      setIsRecommendationFormOpen(false);
      refreshData();

      return Promise.resolve();
    } catch (error) {
      console.error('Error adding recommendation:', error);
      toast({
        title: "Error",
        description: "Failed to add recommendation",
        variant: "destructive"
      });

      return Promise.reject(error);
    }
  };

  const handleReviewSubmit = async () => {
    try {
      setIsReviewFormOpen(false);
      refreshData();

      return Promise.resolve();
    } catch (error) {
      console.error('Error adding review:', error);
      return Promise.reject(error);
    }
  };

  const handleTimelineUpdate = async () => {
    await refreshData();
  };

  const handleTimelineViewerClose = () => {
    setIsTimelineViewerOpen(false);
    setTimelineReviewId(null);
  };

  const handleImageRefresh = async () => {
    if (!entity) return;

    setIsRefreshingImage(true);

    try {
      const newImageUrl = await refreshEntityImage(
        entity.id, 
        entity.api_source === 'google_places' ? entity.api_ref : undefined, 
        entity.photo_reference
      );

      if (newImageUrl) {
        toast({
          title: 'Image refreshed',
          description: 'The image has been successfully updated.',
        });

        refreshData();
      } else {
        toast({
          title: 'Image refresh failed',
          description: 'Unable to refresh the image. Please try again later.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error refreshing image:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while refreshing the image.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingImage(false);
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    setIsLightboxOpen(true);
  };

  const handleLightboxClose = () => {
    setIsLightboxOpen(false);
  };

  const createMediaItem = (): MediaItem => {
    const imageUrl = entity?.image_url || getEntityTypeFallbackImage(entity?.type || EntityType.Place);
    return {
      url: imageUrl,
      type: 'image',
      alt: entity?.name || 'Entity image',
      caption: entity?.name,
      order: 0,
      id: entity?.id || 'entity-image'
    };
  };

  const sidebarButtonConfig = getSidebarButtonConfig();

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      {/* Add canonical meta tag for SEO */}
      {entity && entity.slug && (
        <Helmet>
          <link rel="canonical" href={`${window.location.origin}/entity/${entity.slug}`} />
        </Helmet>
      )}
      
      <NavBarComponent />
      
      {/* Add the floating toggle */}
      <EntityPreviewToggle />
      
      {/* Preview Toggle Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 text-center text-sm font-medium mt-16">
        <div className="flex items-center justify-center gap-2">
          <span>Try the new layout!</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/entity/${slug}?preview=true`)}
            className="text-white hover:bg-white/20 text-xs h-6 px-2"
          >
            <Eye className="h-3 w-3 mr-1" />
            Preview V2
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      <div className="flex-1 pt-0">
        {/* Hero Entity Header Section */}
        <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
          <div className="container max-w-6xl mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Entity Image */}
              <div className="w-full md:w-1/3 lg:w-1/4">
                <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg border shadow-md bg-muted/20 relative group">
                  <div 
                    className="w-full h-full cursor-pointer transition-transform hover:scale-105"
                    onClick={handleImageClick}
                  >
                    <ImageWithFallback
                      src={entity?.image_url || ''}
                      alt={entity?.name || 'Entity image'}
                      className="w-full h-full object-cover"
                      fallbackSrc={getEntityTypeFallbackImage(entity?.type || EntityType.Place)}
                    />
                  </div>

                  {entity?.image_url && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge 
                        variant="outline" 
                        className={`${
                          isEntityImageMigrated(entity.image_url) 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                        } opacity-80 group-hover:opacity-100`}
                      >
                        <Image className="h-3 w-3 mr-1" />
                        {isEntityImageMigrated(entity.image_url) ? 'Local' : 'External'}
                      </Badge>

                      {user && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 bg-white/80 dark:bg-black/50 opacity-80 group-hover:opacity-100"
                          onClick={handleImageRefresh}
                          disabled={isRefreshing || isRefreshingImage}
                        >
                          <RefreshCw className={`h-3 w-3 ${(isRefreshing || isRefreshingImage) ? 'animate-spin' : ''}`} />
                          <span className="sr-only">Refresh image</span>
                        </Button>
                      )}
                    </div>
                  )}
                </AspectRatio>
              </div>

              {/* Entity Details */}
              <div className="flex-1 space-y-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold">{entity?.name}</h1>
                    {entity?.metadata?.verified && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
                        <Flag className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                      {entity?.type}
                    </Badge>
                    {entity?.category_id && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Category
                      </Badge>
                    )}
                  </div>
                  {contextualField?.value && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{contextualField.value}</span>
                    </div>
                  )}

                  {entity?.description && (
                    <p className="text-muted-foreground mt-2">{entity.description}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Keep all remaining JSX exactly the same */}
        {/* Rating Summary Bar */}
        <div className="bg-card border-y dark:bg-card/50 py-4">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="flex flex-wrap items-center gap-6 justify-between">
              <div className="flex items-center gap-8 ml-4">            
                {stats.averageRating !== null ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-fit">
                        <ConnectedRingsRating
                          value={stats.averageRating}
                          variant="badge"
                          showValue={false}
                          size="md"
                          minimal={true}
                        />
                      </div>
                      <span 
                        className="text-lg font-bold" 
                        style={{ color: getSentimentColor(stats.averageRating) }}
                      >
                        {stats.averageRating.toFixed(1)}
                      </span>
                    </div>

                    <div className="leading-tight min-w-[140px]">
                      <div className="font-semibold text-sm whitespace-nowrap">Overall Rating</div>
                      <div className="text-xs text-muted-foreground">
                        Based on {stats.recommendationCount + stats.reviewCount} ratings
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-fit">
                        <ConnectedRingsRating
                          value={0}
                          variant="badge"
                          showValue={false}
                          size="md"
                          minimal={true}
                        />
                      </div>
                      <span className="text-lg font-bold text-muted-foreground">
                        0
                      </span>
                    </div>

                    <div className="leading-tight min-w-[140px]">
                      <div className="font-semibold text-sm whitespace-nowrap">Overall Rating</div>
                      <div className="text-xs text-muted-foreground">
                        Not yet rated
                      </div>
                    </div>
                  </div>
                )}

                {user && (
                  <div className="h-12 w-px bg-border"></div>
                )}

                {user && (
                  circleRating !== null ? (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-fit">
                          <ConnectedRingsRating
                            value={circleRating}
                            variant="badge"
                            showValue={false}
                            size="md"
                            minimal={true}
                          />
                        </div>
                        <span 
                          className="text-lg font-bold" 
                          style={{ color: getSentimentColor(circleRating) }}
                        >
                          {circleRating.toFixed(1)}
                        </span>
                      </div>

                      <div className="leading-tight min-w-[140px]">
                        <div className="font-semibold text-sm whitespace-nowrap">Circle Rating</div>
                        <div className="text-xs text-muted-foreground">
                          Based on {circleRatingCount} rating{circleRatingCount !== 1 ? 's' : ''} from your circle
                        </div>
                        <CircleContributorsPreview 
                          contributors={circleContributors}
                          totalCount={circleRatingCount}
                          maxDisplay={4}
                          entityName={entity?.name}
                          stats={stats}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-fit">
                          <ConnectedRingsRating
                            value={0}
                            variant="badge"
                            showValue={false}
                            size="md"
                            minimal={true}
                          />
                        </div>
                        <span className="text-lg font-bold text-muted-foreground">
                          0
                        </span>
                      </div>

                      <div className="leading-tight min-w-[140px]">
                        <div className="font-semibold text-sm whitespace-nowrap">Circle Rating</div>
                        <div className="text-xs text-muted-foreground">
                          No ratings from your circle
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/20">
                    <MessageSquareHeart className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium">{stats.recommendationCount}</div>
                    <div className="text-sm text-muted-foreground">Recommendations</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-amber-50 dark:bg-amber-900/20">
                    <MessageSquare className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="font-medium">{stats.reviewCount}</div>
                    <div className="text-sm text-muted-foreground">Reviews</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="container max-w-6xl mx-auto py-6 px-4">
          <TooltipProvider>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex gap-3 mb-6 md:hidden">
                  <Button 
                    onClick={handleAddRecommendation}
                    className="flex-1 gap-2"
                  >
                    <MessageSquareHeart className="h-4 w-4" />
                    Recommend
                  </Button>

                  <Button 
                    onClick={sidebarButtonConfig.action}
                    variant="outline" 
                    className="flex-1 gap-2"
                  >
                    <sidebarButtonConfig.icon className="h-4 w-4" />
                    {sidebarButtonConfig.text}
                  </Button>
                </div>

                <Tabs 
                  defaultValue="reviews" 
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="mt-2"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="reviews" className="py-3">
                      All Reviews ({allReviews.length})
                    </TabsTrigger>
                    <TabsTrigger value="dynamic-reviews" className="py-3 flex items-center gap-2">
                      Dynamic Reviews ({dynamicReviews.length})
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-sm">
                            Reviews that evolve over time with timeline updates, 
                            showing how opinions change with extended use.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="reviews" className="space-y-4 mt-2">
                    {!allReviews || allReviews.length === 0 ? (
                      <div className="py-12 text-center border rounded-lg bg-amber-50/30 dark:bg-amber-900/5">
                        <MessageSquare className="h-12 w-12 mx-auto text-amber-300 dark:text-amber-700" />
                        <h3 className="font-medium text-lg mt-4">No reviews yet</h3>
                        <p className="text-muted-foreground mt-2">
                          Be the first to review {entity?.name}!
                        </p>
                        <Button onClick={handleAddReview} className="mt-4 gap-2" variant="outline">
                          <Plus className="h-4 w-4" />
                          Add Review
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            Showing {allReviews.length} review{allReviews.length !== 1 ? 's' : ''}
                          </p>
                          <Button 
                            onClick={sidebarButtonConfig.action}
                            size="sm"
                            variant="outline"
                            className="gap-2 hidden md:flex"
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {allReviews.map((review) => (
                            <div key={review.id} className="relative">
                              <ReviewCard
                                review={review}
                                onLike={() => handleReviewAction('like', review.id)}
                                onSave={() => handleReviewAction('save', review.id)}
                                refreshReviews={refreshData}
                                hideEntityFallbacks={true}
                                compact={true}
                                showTimelineFeatures={review.has_timeline && review.timeline_count && review.timeline_count > 0}
                              />
                              {user && review.user_id === user.id && (!review.has_timeline || !review.timeline_count) && (
                                <div className="mt-2 pl-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStartTimeline(review.id)}
                                    className="text-xs gap-1 h-7"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Start Timeline
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="dynamic-reviews" className="space-y-4 mt-2">
                    {!dynamicReviews || dynamicReviews.length === 0 ? (
                      <div className="py-12 text-center border rounded-lg bg-violet-50/30 dark:bg-violet-900/5">
                        <MessageSquare className="h-12 w-12 mx-auto text-violet-300 dark:text-violet-700" />
                        <h3 className="font-medium text-lg mt-4">
                          {userReview ? 'No timeline updates yet' : 'No dynamic reviews yet'}
                        </h3>
                        <p className="text-muted-foreground mt-2">
                          {userReview ? 
                            'Update your review to show how your experience evolves over time.' :
                            'Dynamic reviews show how opinions evolve over time. Start with a regular review and update it later!'
                          }
                        </p>
                        <Button 
                          onClick={userReview ? () => handleStartTimeline(userReview.id) : handleAddReview} 
                          className="mt-4 gap-2" 
                          variant="outline"
                        >
                          <Plus className="h-4 w-4" />
                          {userReview ? 'Update Review' : 'Add Review'}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <DynamicReviewsSummary 
                          dynamicReviews={dynamicReviews}
                          timelineData={timelineData}
                        />

                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            Showing {dynamicReviews.length} timeline review{dynamicReviews.length !== 1 ? 's' : ''}
                          </p>
                          <Button 
                            onClick={sidebarButtonConfig.action}
                            size="sm"
                            variant="outline"
                            className="gap-2 hidden md:flex"
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {dynamicReviews.map((review) => (
                            <ReviewCard
                              key={review.id}
                              review={review}
                              onLike={() => handleReviewAction('like', review.id)}
                              onSave={() => handleReviewAction('save', review.id)}
                              refreshReviews={refreshData}
                              hideEntityFallbacks={true}
                              compact={true}
                              showTimelineFeatures={true}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              <div className="w-full md:w-72 lg:w-80 space-y-5 order-first md:order-last">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Share Your Experience</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sidebarButtonConfig.tooltip ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            onClick={sidebarButtonConfig.action}
                            className="w-full gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white"
                          >
                            <sidebarButtonConfig.icon className="h-4 w-4" />
                            {sidebarButtonConfig.text}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{sidebarButtonConfig.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button 
                        onClick={sidebarButtonConfig.action}
                        className="w-full gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white"
                      >
                        <sidebarButtonConfig.icon className="h-4 w-4" />
                        {sidebarButtonConfig.text}
                      </Button>
                    )}

                    <Button variant="outline" className="w-full gap-2">
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                  </CardContent>
                </Card>

                {entity && <EntityMetadataCard entity={entity} />}
                {entity && <EntitySpecsCard entity={entity} />}
                {entity && <EntityRelatedCard entity={entity} />}

                {entity && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-medium">Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <div className="font-medium">Type</div>
                        <div className="text-muted-foreground capitalize">{entity.type}</div>
                      </div>

                      {contextualField?.value && (
                        <div className="text-sm">
                          <div className="font-medium">{contextualField.label}</div>
                          <div className="text-muted-foreground">{contextualField.value}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>

      {user && entity && (
        <RecommendationForm
          isOpen={isRecommendationFormOpen}
          onClose={() => setIsRecommendationFormOpen(false)}
          onSubmit={handleRecommendationSubmit}
          onImageUpload={handleImageUpload}
          entity={{
            id: entity.id,
            name: entity.name,
            type: entity.type,
            venue: entity.venue || '',
            image_url: entity.image_url || '',
            description: entity.description || '',
            metadata: entity.metadata
          }}
        />
      )}

      {user && entity && (
        <ReviewForm
          isOpen={isReviewFormOpen}
          onClose={() => setIsReviewFormOpen(false)}
          onSubmit={handleReviewSubmit}
          entity={{
            id: entity.id,
            name: entity.name,
            type: entity.type,
            venue: entity.venue || '',
            image_url: entity.image_url || '',
            description: entity.description || '',
            metadata: entity.metadata
          }}
        />
      )}

      {timelineReviewId && userReview && (
        <ReviewTimelineViewer
          isOpen={isTimelineViewerOpen}
          onClose={handleTimelineViewerClose}
          reviewId={timelineReviewId}
          reviewOwnerId={userReview.user_id}
          reviewTitle={userReview.title}
          initialRating={userReview.rating}
          onTimelineUpdate={handleTimelineUpdate}
        />
      )}

      {isLightboxOpen && entity && (
        <LightboxPreview
          media={[createMediaItem()]}
          initialIndex={0}
          onClose={handleLightboxClose}
        />
      )}

      <Footer />
      <BottomNavigation />
    </div>
  );
};

const EntityDetail = () => {
  const [searchParams] = useSearchParams();
  const { slug } = useParams<{ slug: string }>();
  const version = searchParams.get('v') || (searchParams.get('preview') === 'true' ? '2' : '1');

  // Import EntityV3 and EntityV4 dynamically
  const EntityV3 = React.lazy(() => import('@/components/entity-v3/EntityV3'));
  const EntityV4 = React.lazy(() => import('@/components/entity-v4/EntityV4'));

  // Return appropriate version based on URL parameters
  if (version === '4') {
    return (
      <React.Suspense fallback={<EntityDetailLoadingProgress entityName={slug || 'Entity'} entityType="product" />}>
        <EntityV4 />
      </React.Suspense>
    );
  } else if (version === '3') {
    return (
      <React.Suspense fallback={<EntityDetailLoadingProgress entityName={slug || 'Entity'} entityType="product" />}>
        <EntityV3 />
      </React.Suspense>
    );
  } else if (version === '2') {
    return <EntityDetailV2 />;
  } else {
    return <EntityDetailOriginal />;
  }
};

export default EntityDetail;
