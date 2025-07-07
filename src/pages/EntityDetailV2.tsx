import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Users, Calendar, Plus, Share2, Flag, MessageSquare, MessageSquareHeart, RefreshCw, Image, Info, ArrowLeft, Building2 } from 'lucide-react';
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
import { EntityMetadataCard } from '@/components/entity/EntityMetadataCard';
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
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';
import { EntityProductsCard } from '@/components/entity/EntityProductsCard';
import { EntityFollowButton } from '@/components/entity/EntityFollowButton';
import { EntityChildrenCard } from '@/components/entity/EntityChildrenCard';
import { getEntityWithChildren, EntityWithChildren, getParentEntity } from '@/services/entityHierarchyService';
import { Entity } from '@/services/recommendation/types';
import { BreadcrumbNavigation } from '@/components/ui/breadcrumb-navigation';
import { ParentBrandBadge } from '@/components/entity/ParentBrandBadge';
import { FeaturedProductsSection } from '@/components/entity/FeaturedProductsSection';
import { SiblingProductsSection } from '@/components/entity/SiblingProductsSection';
import { ReviewTypeFilter } from '@/components/entity/ReviewTypeFilter';
import { useEntityMetadataFallback } from '@/hooks/use-entity-metadata-fallback';

const EntityDetailV2 = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'all' | 'product' | 'brand'>('all');
  const { handleImageUpload } = useRecommendationUploads();
  
  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [timelineReviewId, setTimelineReviewId] = useState<string | null>(null);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);
  const [entityWithChildren, setEntityWithChildren] = useState<EntityWithChildren | null>(null);
  const [parentEntity, setParentEntity] = useState<Entity | null>(null);
  
  const { refreshEntityImage, isRefreshing, isEntityImageMigrated } = useEntityImageRefresh();
  
  // Main entity data hook - call this first and consistently
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

  // Create stable entity default to prevent hook violations
  const stableEntityDefault = useMemo(() => ({
    id: '',
    name: '',
    type: 'product' as const,
    description: '',
    image_url: '',
    api_ref: null,
    api_source: null,
    metadata: {},
    venue: null,
    website_url: null,
    slug: null,
    category_id: null,
    popularity_score: null,
    photo_reference: null,
    created_at: null,
    updated_at: null,
    authors: null,
    publication_year: null,
    isbn: null,
    languages: null,
    external_ratings: null,
    price_info: null,
    specifications: null,
    cast_crew: null,
    ingredients: null,
    nutritional_info: null,
    last_enriched_at: null,
    enrichment_source: null,
    data_quality_score: null,
    parent_id: null
  }), []);

  // Always call hooks with stable parameters - this prevents hook violations
  const enhancedEntity = useEntityMetadataFallback({ 
    entity: entity || stableEntityDefault, 
    parentEntity: parentEntity || null
  });
  
  const {
    circleRating,
    circleRatingCount,
    circleContributors,
    isLoading: isCircleRatingLoading
  } = useCircleRating(entity?.id || '');

  const { summary: timelineData, isLoading: isTimelineLoading, error: timelineError } = useEntityTimelineSummary(entity?.id || null);

  // Use actual entity if available, otherwise use enhanced fallback
  const displayEntity = entity || enhancedEntity;

  // Memoized derived data to prevent unnecessary re-renders
  const dynamicReviews = useMemo(() => {
    if (!reviews) return [];
    return reviews.filter(review => review.has_timeline && review.timeline_count && review.timeline_count > 0);
  }, [reviews]);

  const allReviews = useMemo(() => {
    return reviews || [];
  }, [reviews]);

  const userReview = useMemo(() => {
    if (!user || !reviews) return null;
    return reviews.find(review => review.user_id === user.id);
  }, [user, reviews]);

  const filteredReviews = useMemo(() => {
    if (!allReviews || reviewTypeFilter === 'all') {
      return allReviews;
    }
    return allReviews;
  }, [allReviews, reviewTypeFilter]);

  const reviewTypeCounts = useMemo(() => {
    return {
      product: allReviews?.length || 0,
      brand: 0,
    };
  }, [allReviews]);

  const breadcrumbItems = useMemo(() => {
    const items = [];
    
    if (parentEntity) {
      items.push({
        label: parentEntity.name,
        href: `/entity-v2/${parentEntity.slug || parentEntity.id}`,
      });
    }
    
    if (displayEntity && displayEntity.id) {
      items.push({
        label: displayEntity.name,
        href: `/entity-v2/${displayEntity.slug || displayEntity.id}`,
        isActive: true,
      });
    }
    
    return items;
  }, [displayEntity, parentEntity]);

  // Entity hierarchy fetching - only when entity is available
  useEffect(() => {
    const fetchEntityWithChildren = async () => {
      if (!entity?.id) return;
      
      try {
        const entityData = await getEntityWithChildren(entity.id);
        setEntityWithChildren(entityData);
      } catch (error) {
        console.error('Error fetching entity with children:', error);
      }
    };

    fetchEntityWithChildren();
  }, [entity?.id]);

  useEffect(() => {
    const fetchParentEntity = async () => {
      if (!entity?.parent_id) return;
      
      try {
        const parentData = await getParentEntity(entity.id);
        setParentEntity(parentData);
      } catch (error) {
        console.error('Error fetching parent entity:', error);
      }
    };

    fetchParentEntity();
  }, [entity?.id, entity?.parent_id]);

  // Early return for loading and error states - after all hooks are called
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

  const handleViewAllProducts = () => {
    setActiveTab('products');
  };

  const getEntityTypeFallbackImage = (type: string): string => {
    const fallbacks: Record<string, string> = {
      'movie': 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
      'book': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
      'food': 'https://images.unsplash.com/photo-1555939594-58d7698950b',
      'place': 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
      'product': 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
      'activity': 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
      'music': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
      'art': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
      'tv': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
      'drink': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87',
      'travel': 'https://images.unsplash.com/photo-1501554728187-ce583db33af7'
    };
    
    return fallbacks[type] || 'https://images.unsplash.com/photo-1501854140801-50d01698950b';
  };

  const getContextualFieldInfo = () => {
    if (!displayEntity) return null;
    
    switch (displayEntity.type) {
      case 'book':
        return {
          label: 'Author',
          value: displayEntity.authors && displayEntity.authors.length > 0 
            ? displayEntity.authors[0] 
            : displayEntity.venue || null
        };
      case 'movie':
      case 'tv':
        return {
          label: 'Studio',
          value: displayEntity.cast_crew?.studio || displayEntity.venue || null
        };
      case 'place':
        return {
          label: 'Location',
          value: displayEntity.api_source === 'google_places' && displayEntity.metadata?.formatted_address
            ? displayEntity.metadata.formatted_address
            : displayEntity.venue || null
        };
      case 'product':
        return {
          label: 'Brand',
          value: displayEntity.specifications?.brand || displayEntity.venue || null
        };
      case 'music':
        return {
          label: 'Artist',
          value: displayEntity.venue || null
        };
      case 'food':
      case 'drink':
        return {
          label: 'Venue',
          value: displayEntity.venue || null
        };
      default:
        return {
          label: 'Source',
          value: displayEntity.venue || null
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
    if (!displayEntity) return;
    
    setIsRefreshingImage(true);
    
    try {
      const newImageUrl = await refreshEntityImage(
        displayEntity.id, 
        displayEntity.api_source === 'google_places' ? displayEntity.api_ref : undefined, 
        displayEntity.photo_reference
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
    const imageUrl = displayEntity?.image_url || getEntityTypeFallbackImage(displayEntity?.type || 'place');
    return {
      url: imageUrl,
      type: 'image',
      alt: displayEntity?.name || 'Entity image',
      caption: displayEntity?.name,
      order: 0,
      id: displayEntity?.id || 'entity-image'
    };
  };

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
  
  const sidebarButtonConfig = getSidebarButtonConfig();

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <NavBarComponent />
      
      <EntityPreviewToggle />
      
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
            {breadcrumbItems.length > 0 && (
              <BreadcrumbNavigation items={breadcrumbItems} />
            )}

            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-1/3 lg:w-1/4">
                <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg border shadow-md bg-muted/20 relative group">
                  <div 
                    className="w-full h-full cursor-pointer transition-transform hover:scale-105"
                    onClick={handleImageClick}
                  >
                    <ImageWithFallback
                      src={displayEntity?.image_url || ''}
                      alt={displayEntity?.name || 'Entity image'}
                      className="w-full h-full object-cover"
                      fallbackSrc={getEntityTypeFallbackImage(displayEntity?.type || 'place')}
                    />
                  </div>
                  
                  {displayEntity?.image_url && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge 
                        variant="outline" 
                        className={`${
                          isEntityImageMigrated(displayEntity.image_url) 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                        } opacity-80 group-hover:opacity-100`}
                      >
                        <Image className="h-3 w-3 mr-1" />
                        {isEntityImageMigrated(displayEntity.image_url) ? 'Local' : 'External'}
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
                  {parentEntity && (
                    <ParentBrandBadge 
                      parentEntity={parentEntity}
                      currentEntityName={displayEntity?.name}
                    />
                  )}

                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold">{displayEntity?.name}</h1>
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 gap-1">
                      <Flag className="h-3 w-3" /> V2 Preview
                    </Badge>
                    {entityWithChildren?.children && entityWithChildren.children.length > 0 && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
                        <Building2 className="h-3 w-3" /> Brand ({entityWithChildren.children.length} Products)
                      </Badge>
                    )}
                    {displayEntity?.metadata?.verified && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
                        <Flag className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                      {displayEntity?.type}
                    </Badge>
                  </div>
                  
                  {displayEntity?.description && (
                    <p className="text-muted-foreground mt-2">{displayEntity.description}</p>
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
                        entityName={displayEntity?.name}
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
                    <FeaturedProductsSection
                      children={entityWithChildren?.children}
                      parentName={displayEntity?.name || ''}
                      onViewAll={handleViewAllProducts}
                    />
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>About {displayEntity?.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {displayEntity?.description ? (
                          <p className="text-muted-foreground">{displayEntity.description}</p>
                        ) : (
                          <p className="text-muted-foreground italic">No description available.</p>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                          <div>
                            <h4 className="font-medium mb-2">Type</h4>
                            <Badge variant="outline">{displayEntity?.type}</Badge>
                          </div>
                          
                          {displayEntity?.venue && (
                            <div>
                              <h4 className="font-medium mb-2">Source</h4>
                              <p className="text-sm text-muted-foreground">{displayEntity.venue}</p>
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
                            <Card key={child.id} className="hover:shadow-md transition-shadow cursor-pointer">
                              <CardContent className="p-4">
                                {child.image_url && (
                                  <div className="w-full h-32 rounded-md overflow-hidden bg-muted mb-3">
                                    <ImageWithFallback
                                      src={child.image_url}
                                      alt={child.name}
                                      className="w-full h-full object-cover"
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
                                  <Badge variant="outline" className="text-xs">
                                    {child.type}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="reviews" className="space-y-4 mt-2">
                    {!allReviews || allReviews.length === 0 ? (
                      <div className="py-12 text-center border rounded-lg bg-amber-50/30 dark:bg-amber-900/5">
                        <MessageSquare className="h-12 w-12 mx-auto text-amber-300 dark:text-amber-700" />
                        <h3 className="font-medium text-lg mt-4">No reviews yet</h3>
                        <p className="text-muted-foreground mt-2">
                          Be the first to review {displayEntity?.name}!
                        </p>
                        <Button onClick={handleAddReview} className="mt-4 gap-2" variant="outline">
                          <Plus className="h-4 w-4" />
                          Add Review
                        </Button>
                      </div>
                    ) : (
                      <>
                        <ReviewTypeFilter
                          reviewTypes={reviewTypeCounts}
                          selectedType={reviewTypeFilter}
                          onTypeChange={setReviewTypeFilter}
                          entityName={displayEntity?.name || ''}
                        />

                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            Showing {filteredReviews.length} review{filteredReviews.length !== 1 ? 's' : ''}
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
                          {filteredReviews.map((review) => (
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
                        <p>📱 Will show: Posts where users tag {displayEntity?.name}</p>
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
                    
                    {displayEntity && displayEntity.id && (
                      <EntityFollowButton
                        entityId={displayEntity.id}
                        entityName={displayEntity.name}
                        variant="outline"
                        size="default"
                        showCount={true}
                      />
                    )}
                  </CardContent>
                </Card>
                
                {displayEntity && displayEntity.id && (
                  <EntityProductsCard
                    entityId={displayEntity.id}
                    entityName={displayEntity.name}
                  />
                )}
                
                {entityWithChildren?.children && entityWithChildren.children.length > 0 && (
                  <EntityChildrenCard
                    children={entityWithChildren.children}
                    parentName={displayEntity?.name || ''}
                    onViewChild={(child) => navigate(`/entity/${child.slug || child.id}`)}
                  />
                )}
                
                {displayEntity && <EntityMetadataCard entity={displayEntity} />}
                
                {displayEntity && <EntitySpecsCard entity={displayEntity} />}
                
                {displayEntity && <EntityRelatedCard entity={displayEntity} />}
              </div>
            </div>
          </TooltipProvider>
        </div>

        {parentEntity && entityWithChildren?.children && entityWithChildren.children.length > 1 && (
          <div className="container max-w-6xl mx-auto px-4 pb-6">
            <SiblingProductsSection
              siblings={entityWithChildren.children}
              parentName={parentEntity.name}
              currentEntityId={displayEntity?.id || ''}
            />
          </div>
        )}
      </div>
      
      {user && displayEntity && displayEntity.id && (
        <RecommendationForm
          isOpen={isRecommendationFormOpen}
          onClose={() => setIsRecommendationFormOpen(false)}
          onSubmit={handleRecommendationSubmit}
          onImageUpload={handleImageUpload}
          entity={{
            id: displayEntity.id,
            name: displayEntity.name,
            type: displayEntity.type,
            venue: displayEntity.venue || '',
            image_url: displayEntity.image_url || '',
            description: displayEntity.description || '',
            metadata: displayEntity.metadata
          }}
        />
      )}
      
      {user && displayEntity && displayEntity.id && (
        <ReviewForm
          isOpen={isReviewFormOpen}
          onClose={() => setIsReviewFormOpen(false)}
          onSubmit={handleReviewSubmit}
          entity={{
            id: displayEntity.id,
            name: displayEntity.name,
            type: displayEntity.type,
            venue: displayEntity.venue || '',
            image_url: displayEntity.image_url || '',
            description: displayEntity.description || '',
            metadata: displayEntity.metadata
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

      {isLightboxOpen && displayEntity && (
        <LightboxPreview
          media={[{
            url: displayEntity.image_url || getEntityTypeFallbackImage(displayEntity.type || 'place'),
            type: 'image',
            alt: displayEntity.name || 'Entity image',
            caption: displayEntity.name,
            order: 0,
            id: displayEntity.id || 'entity-image'
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
