import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Users, Calendar, Plus, Share2, Flag, MessageSquare, MessageSquareHeart, RefreshCw, Image, Info, ArrowLeft, ArrowRight } from 'lucide-react';
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
import { formatRelativeDate } from '@/utils/dateUtils';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { EntityDetailSkeleton } from '@/components/entity/EntityDetailSkeleton';
import { EntityMetadataCard, hasMetadataContent } from '@/components/entity/EntityMetadataCard';
import { EntitySpecsCard } from '@/components/entity/EntitySpecsCard';
import { EntityRelatedCard } from '@/components/entity/EntityRelatedCard';
import { EntityDetailLoadingProgress } from '@/components/ui/entity-detail-loading-progress';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { MediaItem } from '@/types/media';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { CircleContributorsPreview } from '@/components/recommendations/CircleContributorsPreview';
import { TimelinePreview } from '@/components/profile/reviews/TimelinePreview';
import { TimelineBadge } from '@/components/profile/reviews/TimelineBadge';
import { DynamicReviewsSummary } from '@/components/profile/reviews/DynamicReviewsSummary';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { useEntityTimelineSummary } from '@/hooks/use-entity-timeline-summary';
import { getSentimentColor } from '@/utils/ratingColorUtils';
import { EntityProductsCard } from '@/components/entity/EntityProductsCard';
import { EntityFollowButton } from '@/components/entity/EntityFollowButton';
import { EntityChildrenCard } from '@/components/entity/EntityChildrenCard';
import { EntityParentBreadcrumb } from '@/components/entity/EntityParentBreadcrumb';
import { useEntityHierarchy } from '@/hooks/use-entity-hierarchy';
import { useEntitySiblings } from '@/hooks/use-entity-siblings';
import { getEntityTypeFallbackImage, getCanonicalType, getContextualFieldLabel } from '@/services/entityTypeHelpers';
import { Entity, EntityType } from '@/services/recommendation/types';
import { getEntityUrlWithParent } from '@/utils/entityUrlUtils';
import { ExternalLinksSection } from '@/components/entity/ExternalLinksSection';
import { FeaturedProductsSection } from '@/components/entity/FeaturedProductsSection';
import { SiblingCarousel } from '@/components/entity/SiblingCarousel';
import { ReviewTypeToggle } from '@/components/entity/ReviewTypeToggle';

const EntityDetailV2 = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [reviewType, setReviewType] = useState<'product' | 'brand'>('product');
  const { handleImageUpload } = useRecommendationUploads();
  
  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [timelineReviewId, setTimelineReviewId] = useState<string | null>(null);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);
  
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

  const {
    entityWithChildren,
    parentEntity,
    isLoading: isLoadingHierarchy,
    error: hierarchyError,
    hasChildren,
    hasParent
  } = useEntityHierarchy(entity?.id || null);

  const {
    refreshEntityImage,
    isRefreshing,
    isEntityImageMigrated
  } = useEntityImageRefresh();
  
  const {
    circleRating,
    circleRatingCount,
    circleContributors,
    isLoading: isCircleRatingLoading
  } = useCircleRating(entity?.id || '');

  const {
    siblings,
    isLoading: isSiblingsLoading,
    error: siblingsError
  } = useEntitySiblings(entity?.id || null, parentEntity?.id || null);
  
  const dynamicReviews = React.useMemo(() => {
    if (!reviews) return [];
    return reviews.filter(review => review.has_timeline && review.timeline_count && review.timeline_count > 0);
  }, [reviews]);

  const allReviews = React.useMemo(() => {
    if (!reviews) return [];
    return reviews;
  }, [reviews]);

  const userReview = React.useMemo(() => {
    if (!user || !reviews) return null;
    return reviews.find(review => review.user_id === user.id);
  }, [user, reviews]);

  const { summary: timelineData, isLoading: isTimelineLoading, error: timelineError } = useEntityTimelineSummary(entity?.id || null);

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
    
    // Normalize to canonical type before switching
    const canonicalType = getCanonicalType(entity.type);
    
    switch (canonicalType) {
      case EntityType.Book:
        return {
          label: 'Author',
          value: entity.authors && entity.authors.length > 0 
            ? entity.authors[0] 
            : entity.venue || null
        };
      case EntityType.Movie:
      case EntityType.TVShow:  // ✅ Canonical
        return {
          label: 'Studio',
          value: entity.cast_crew?.studio || entity.venue || null
        };
      case EntityType.Place:
      case EntityType.Experience:  // ✅ Canonical
        return {
          label: 'Location',
          value: entity.api_source === 'google_places' && entity.metadata?.formatted_address
            ? entity.metadata.formatted_address
            : entity.venue || null
        };
      case EntityType.Product:
      case EntityType.Course:  // ✅ Canonical
      case EntityType.App:     // ✅ Canonical
      case EntityType.Game:    // ✅ Canonical
        return {
          label: 'Brand',
          value: entity.specifications?.brand || entity.venue || null
        };
      case EntityType.Music:
        return {
          label: 'Artist',
          value: entity.venue || null
        };
      case EntityType.Food:
        return {
          label: 'Venue',
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

  const handleViewChild = (child: Entity) => {
    navigate(`${getEntityUrlWithParent(child)}?preview=true`);
  };

  const handleViewSibling = (sibling: Entity) => {
    navigate(`${getEntityUrlWithParent(sibling)}?preview=true`);
  };

  const handleAddChild = () => {
    // TODO: Implement add child functionality
    toast({
      title: "Coming Soon",
      description: "Add child entity functionality will be available soon.",
    });
  };

  const handleViewAllProducts = () => {
    setActiveTab('products');
  };

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <NavBarComponent />
      
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 text-center text-sm font-medium mt-16">
        <div className="flex items-center justify-center gap-2">
          <span>🔥 Preview Mode: New Entity Layout</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/entity/${slug}`)}
            className="text-white hover:bg-white/20 text-xs h-6 px-2"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Original
          </Button>
        </div>
      </div>
      
      <div className="flex-1">
        <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
          <div className="container max-w-6xl mx-auto py-8 px-4">
            {entity && (
              <EntityParentBreadcrumb
                currentEntity={entity}
                parentEntity={parentEntity}
                isLoading={isLoadingHierarchy}
              />
            )}
            
            <div className="flex flex-col md:flex-row gap-8">
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
              
              <div className="flex-1 space-y-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold">{entity?.name}</h1>
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 gap-1">
                      <Flag className="h-3 w-3" /> V2 Preview
                    </Badge>
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
                  </div>
                  
                  {entity?.description && (
                    <p className="text-muted-foreground mt-2">{entity.description}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
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

                {user && circleRating !== null && (
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
                    onClick={handleAddReview}
                    variant="outline" 
                    className="flex-1 gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Review
                  </Button>
                </div>
                
                <Tabs 
                  defaultValue="overview" 
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="mt-2"
                >
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="overview" className="py-3">
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="products" className="py-3">
                      Products ({entityWithChildren?.children?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="py-3">
                      Reviews ({allReviews.length})
                    </TabsTrigger>
                    <TabsTrigger value="posts" className="py-3">
                      Posts (0)
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-6 mt-2">
                    {/* Featured Products Section */}
                    {entityWithChildren?.children && entityWithChildren.children.length > 0 && (
                      <FeaturedProductsSection
                        children={entityWithChildren.children}
                        onViewChild={handleViewChild}
                        onViewAllProducts={handleViewAllProducts}
                      />
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle>About {entity?.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {entity?.description ? (
                          <p className="text-muted-foreground">{entity.description}</p>
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
                  </TabsContent>
                  
                  <TabsContent value="products" className="space-y-4 mt-2">
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
                                onClick={() => navigate(`${getEntityUrlWithParent(parentEntity)}?preview=true`)}
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
                          {user && (
                            <Button
                              onClick={handleAddChild}
                              size="sm"
                              variant="outline"
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add Product
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {entityWithChildren.children.map((child) => (
                            <Card 
                              key={child.id} 
                              className="hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => handleViewChild(child)}
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
                  
                  <TabsContent value="reviews" className="space-y-4 mt-2">
                    {/* Review Type Toggle - only show if both types exist or might exist */}
                    {parentEntity && (
                      <ReviewTypeToggle
                        activeType={reviewType}
                        onTypeChange={setReviewType}
                        productReviewCount={allReviews.length}
                        brandReviewCount={0} // TODO: Fetch parent reviews
                        productName={entity?.name}
                        brandName={parentEntity?.name}
                      />
                    )}

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
                            onClick={handleAddReview}
                            size="sm"
                            variant="outline"
                            className="gap-2 hidden md:flex"
                          >
                            <Plus className="h-4 w-4" />
                            Add Review
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {allReviews.map((review) => (
                            <ReviewCard
                              key={review.id}
                              review={review}
                              onLike={() => handleReviewAction('like', review.id)}
                              onSave={() => handleReviewAction('save', review.id)}
                              refreshReviews={refreshData}
                              hideEntityFallbacks={true}
                              compact={true}
                              showTimelineFeatures={review.has_timeline && review.timeline_count && review.timeline_count > 0}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="posts" className="space-y-4 mt-2">
                    <div className="py-12 text-center border rounded-lg bg-green-50/30 dark:bg-green-900/5">
                      <MessageSquare className="h-12 w-12 mx-auto text-green-300 dark:text-green-700" />
                      <h3 className="font-medium text-lg mt-4">No posts yet</h3>
                      <p className="text-muted-foreground mt-2">
                        Social posts tagged with this entity will appear here.
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <p>🔄 Coming in Phase 4: Social Posts Integration</p>
                        <p>📱 Will show: Posts where users tag {entity?.name}</p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="w-full md:w-72 lg:w-80 space-y-5 order-first md:order-last">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Share Your Experience</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      onClick={handleAddReview}
                      className="w-full gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Write Review
                    </Button>
                    
                    {entity && (
                      <EntityFollowButton
                        entityId={entity.id}
                        entityName={entity.name}
                        variant="outline"
                        size="default"
                      />
                    )}

                    {/* External Links Section */}
                    {entity && (
                      <ExternalLinksSection entity={entity} />
                    )}
                  </CardContent>
                </Card>
                
                <EntityProductsCard
                  entityId={entity.id}
                  entityName={entity.name}
                />
                
                {entityWithChildren?.children && entityWithChildren.children.length > 0 && (
                  <EntityChildrenCard
                    children={entityWithChildren.children}
                    parentName={entity?.name || ''}
                    parentEntity={entity}
                    onViewChild={handleViewChild}
                    onAddChild={handleAddChild}
                    canAddChildren={user !== null}
                    isLoading={isLoadingHierarchy}
                  />
                )}
                
                {parentEntity && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Part of</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`${getEntityUrlWithParent(parentEntity)}?preview=true`)}
                      >
                        {parentEntity.image_url && (
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            <ImageWithFallback
                              src={parentEntity.image_url}
                              alt={parentEntity.name}
                              className="w-full h-full object-cover"
                              fallbackSrc={getEntityTypeFallbackImage(parentEntity.type)}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {parentEntity.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Parent entity
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {entity && hasMetadataContent(entity) && <EntityMetadataCard entity={entity} />}
                
                {entity && <EntitySpecsCard entity={entity} />}
                
                {entity && <EntityRelatedCard entity={entity} />}
              </div>
            </div>
          </TooltipProvider>
        </div>

        {/* Sibling Carousel - only show for child entities */}
        {parentEntity && siblings.length > 0 && (
          <div className="container max-w-6xl mx-auto px-4">
            <SiblingCarousel
              siblings={siblings}
              parentName={parentEntity.name}
              onViewSibling={handleViewSibling}
            />
          </div>
        )}
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
          media={[{
            url: entity.image_url || getEntityTypeFallbackImage(entity.type || EntityType.Place),
            type: 'image',
            alt: entity.name || 'Entity image',
            caption: entity.name,
            order: 0,
            id: entity.id || 'entity-image'
          }]}
          initialIndex={0}
          onClose={handleLightboxClose}
        />
      )}
      
      <Footer />
      <BottomNavigation />
    </div>
  );
};

export default EntityDetailV2;
