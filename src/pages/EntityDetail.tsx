import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Users, Calendar, Plus, Share2, Flag, MessageSquare, MessageSquareHeart, RefreshCw, Image } from 'lucide-react';
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

const EntityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('recommendations');
  const { handleImageUpload } = useRecommendationUploads();
  
  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
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
  
  // Add circle rating hook with destructured new structure
  const {
    circleRating,
    circleRatingCount,
    circleContributors,
    isLoading: isCircleRatingLoading
  } = useCircleRating(entity?.id || '');
  
  useEffect(() => {
    if (!isLoading) {
      console.log('EntityDetail component received recommendations:', recommendations?.length);
      console.log('EntityDetail component received reviews:', reviews?.length);
      if (recommendations?.length > 0) {
        console.log('Sample recommendation:', recommendations[0]);
      }
      if (reviews?.length > 0) {
        console.log('Sample review:', reviews[0]);
      }
    }
  }, [isLoading, recommendations, reviews]);

  // Log contributors when available for debugging
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
    if (!entity) return null;
    
    switch (entity.type) {
      case 'book':
        return {
          label: 'Author',
          value: entity.authors && entity.authors.length > 0 
            ? entity.authors[0] 
            : entity.venue || null
        };
      case 'movie':
      case 'tv':
        return {
          label: 'Studio',
          value: entity.cast_crew?.studio || entity.venue || null
        };
      case 'place':
        return {
          label: 'Location',
          value: entity.api_source === 'google_places' && entity.metadata?.formatted_address
            ? entity.metadata.formatted_address
            : entity.venue || null
        };
      case 'product':
        return {
          label: 'Brand',
          value: entity.specifications?.brand || entity.venue || null
        };
      case 'music':
        return {
          label: 'Artist',
          value: entity.venue || null
        };
      case 'food':
      case 'drink':
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
    // Prevent lightbox from opening if clicking on overlay buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    setIsLightboxOpen(true);
  };

  const handleLightboxClose = () => {
    setIsLightboxOpen(false);
  };

  // Create media item for lightbox
  const createMediaItem = (): MediaItem => {
    const imageUrl = entity?.image_url || getEntityTypeFallbackImage(entity?.type || 'place');
    return {
      url: imageUrl,
      type: 'image',
      alt: entity?.name || 'Entity image',
      caption: entity?.name,
      order: 0,
      id: entity?.id || 'entity-image'
    };
  };

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <NavBarComponent />
      <div className="flex-1 pt-16">
        {/* Hero Entity Header Section */}
        <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
          <div className="container max-w-6xl mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Entity Image */}
              <div className="w-full md:w-1/3 lg:w-1/4">
                <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg border shadow-md bg-muted/20 relative group">
                  {/* Clickable image container */}
                  <div 
                    className="w-full h-full cursor-pointer transition-transform hover:scale-105"
                    onClick={handleImageClick}
                  >
                    <ImageWithFallback
                      src={entity?.image_url || ''}
                      alt={entity?.name || 'Entity image'}
                      className="w-full h-full object-cover"
                      fallbackSrc={getEntityTypeFallbackImage(entity?.type || 'place')}
                    />
                  </div>
                  
                  {/* Image source indicator and refresh button */}
                  {entity?.image_url && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      {/* Image source indicator */}
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
                      
                      {/* Refresh button - only show for users */}
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
                  
                  {/* Description */}
                  {entity?.description && (
                    <p className="text-muted-foreground mt-2">{entity.description}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Rating Summary Bar */}
        <div className="bg-card border-y dark:bg-card/50 py-4">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="flex flex-wrap items-center gap-6 justify-between">
              {/* Rating Display */}
              <div className="flex items-center gap-8 ml-4">
                {/* Overall Rating */}
                {stats.averageRating !== null ? (
                  <div className="flex items-center gap-4">
                    {/* Rings and rating number together */}
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
                      <span className="text-lg font-bold" style={{ color: stats.averageRating < 2 ? "#ea384c" : stats.averageRating < 3 ? "#F97316" : stats.averageRating < 4 ? "#FEC006" : stats.averageRating < 4.5 ? "#84cc16" : "#22c55e" }}>
                        {stats.averageRating.toFixed(1)}
                      </span>
                    </div>
                    
                    {/* Text labels */}
                    <div className="leading-tight min-w-[140px]">
                      <div className="font-semibold text-sm whitespace-nowrap">Overall Rating</div>
                      <div className="text-xs text-muted-foreground">
                        Based on {stats.recommendationCount + stats.reviewCount} ratings
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    {/* Rings and rating number together */}
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
                    
                    {/* Text labels */}
                    <div className="leading-tight min-w-[140px]">
                      <div className="font-semibold text-sm whitespace-nowrap">Overall Rating</div>
                      <div className="text-xs text-muted-foreground">
                        Not yet rated
                      </div>
                    </div>
                  </div>
                )}

                {/* Vertical Divider */}
                {user && (
                  <div className="h-12 w-px bg-border"></div>
                )}

                {/* Circle Rating */}
                {user && (
                  circleRating !== null ? (
                    <div className="flex items-center gap-4">
                      {/* Rings and rating number together */}
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
                        <span className="text-lg font-bold" style={{ color: circleRating < 2 ? "#ea384c" : circleRating < 3 ? "#F97316" : circleRating < 4 ? "#FEC006" : circleRating < 4.5 ? "#84cc16" : "#22c55e" }}>
                          {circleRating.toFixed(1)}
                        </span>
                      </div>
                      
                      {/* Text labels and contributors */}
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
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      {/* Rings and rating number together */}
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
                      
                      {/* Text labels */}
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
              
              {/* Stats */}
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
          <div className="flex flex-col md:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1">
              {/* Action Buttons - Mobile Only */}
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
              
              {/* Content Tabs */}
              <Tabs 
                defaultValue="recommendations" 
                value={activeTab}
                onValueChange={setActiveTab}
                className="mt-2"
              >
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="recommendations" className="py-3">
                    Recommendations ({stats.recommendationCount})
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="py-3">
                    Reviews ({stats.reviewCount})
                  </TabsTrigger>
                </TabsList>
                
                {/* Recommendations Tab */}
                <TabsContent value="recommendations" className="space-y-4 mt-2">
                  {!recommendations || recommendations.length === 0 ? (
                    <div className="py-12 text-center border rounded-lg bg-violet-50/30 dark:bg-violet-900/5">
                      <MessageSquareHeart className="h-12 w-12 mx-auto text-violet-300 dark:text-violet-700" />
                      <h3 className="font-medium text-lg mt-4">No recommendations yet</h3>
                      <p className="text-muted-foreground mt-2">
                        Be the first to recommend {entity?.name}!
                      </p>
                      <Button onClick={handleAddRecommendation} className="mt-4 gap-2">
                        <Plus className="h-4 w-4" />
                        Add Recommendation
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Showing {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
                        </p>
                        <Button 
                          onClick={handleAddRecommendation}
                          size="sm"
                          variant="outline"
                          className="gap-2 hidden md:flex"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {recommendations.map((recommendation) => (
                          <RecommendationCard
                            key={recommendation.id}
                            recommendation={recommendation}
                            onLike={() => handleRecommendationAction('like', recommendation.id)}
                            onSave={() => handleRecommendationAction('save', recommendation.id)}
                            hideEntityFallbacks={true}
                            compact={true}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
                
                {/* Reviews Tab */}
                <TabsContent value="reviews" className="space-y-4 mt-2">
                  {!reviews || reviews.length === 0 ? (
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
                          Showing {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                        </p>
                        <Button 
                          onClick={handleAddReview}
                          size="sm"
                          variant="outline"
                          className="gap-2 hidden md:flex"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {reviews.map((review) => (
                          <ReviewCard
                            key={review.id}
                            review={review}
                            onLike={() => handleReviewAction('like', review.id)}
                            onSave={() => handleReviewAction('save', review.id)}
                            refreshReviews={refreshData}
                            hideEntityFallbacks={true}
                            compact={true}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Enhanced Right Sidebar with new metadata components */}
            <div className="w-full md:w-72 lg:w-80 space-y-5 order-first md:order-last">
              {/* Share Your Experience Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium">Share Your Experience</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={handleAddRecommendation}
                    className="w-full gap-2"
                  >
                    <MessageSquareHeart className="h-4 w-4" />
                    Recommend
                  </Button>
                  
                  <Button 
                    onClick={handleAddReview}
                    variant="outline" 
                    className="w-full gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Write Review
                  </Button>
                  
                  <Button variant="outline" className="w-full gap-2">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </CardContent>
              </Card>
              
              {/* Enhanced Entity Metadata Card */}
              {entity && <EntityMetadataCard entity={entity} />}
              
              {/* Entity Specifications Card */}
              {entity && <EntitySpecsCard entity={entity} />}
              
              {/* Related Entities Card */}
              {entity && <EntityRelatedCard entity={entity} />}
              
              {/* Simplified Basic Info Card - only essential fields */}
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
        </div>
      </div>
      
      {/* Add Recommendation Form */}
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
      
      {/* Add Review Form */}
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

      {/* Lightbox Preview */}
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

export default EntityDetail;
