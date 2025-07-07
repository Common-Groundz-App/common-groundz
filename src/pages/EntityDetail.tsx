
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

import { 
  mapDatabaseEntityType, 
  getEntityTypeDisplayName, 
  getEntityTypeFallbackImage,
  getEntityTypeAction 
} from '@/services/entityTypeMapping';

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
    error,
    refreshData
  } = useEntityDetail(slug || '');

  const [media, setMedia] = useState<any[]>([]);

  useEffect(() => {
    if (entity?.image_url) {
      setMedia([{
        id: entity.id,
        url: entity.image_url,
        type: 'image',
        thumbnail_url: entity.image_url,
        metadata: {},
        order: 0,
        caption: entity.name,
        alt: entity.name,
        is_deleted: false,
        session_id: 'entity-image'
      }]);
    }
  }, [entity?.image_url, entity?.name, entity?.id]);

  // Safe fallback image function using type mapping
  const getEntityTypeFallbackImageSafe = (type: string): string => {
    const mappedType = mapDatabaseEntityType(type);
    return getEntityTypeFallbackImage(mappedType);
  };

  // Safe contextual field info using type mapping
  const getContextualFieldInfo = () => {
    if (!entity) return null;
    
    const mappedType = mapDatabaseEntityType(entity.type);
    
    return getEntityTypeAction(mappedType, {
      [mapDatabaseEntityType('book')]: {
        label: 'Author',
        value: entity.authors && entity.authors.length > 0 
          ? entity.authors[0] 
          : entity.venue || null
      },
      [mapDatabaseEntityType('movie')]: {
        label: 'Studio',
        value: entity.cast_crew?.studio || entity.venue || null
      },
      [mapDatabaseEntityType('place')]: {
        label: 'Location',
        value: entity.api_source === 'google_places' && entity.metadata?.formatted_address
          ? entity.metadata.formatted_address
          : entity.venue || null
      },
      [mapDatabaseEntityType('product')]: {
        label: 'Brand',
        value: entity.specifications?.brand || entity.venue || null
      },
      [mapDatabaseEntityType('food')]: {
        label: 'Venue',
        value: entity.venue || null
      }
    }, {
      label: 'Source',
      value: entity.venue || null
    });
  };

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

  const handleImageClick = () => {
    setIsLightboxOpen(true);
  };

  const handleLightboxClose = () => {
    setIsLightboxOpen(false);
  };

  // Safe type display
  const getEntityTypeDisplaySafe = (type: string): string => {
    const mappedType = mapDatabaseEntityType(type);
    return getEntityTypeDisplayName(mappedType);
  };

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

  if (!isLoading && (error || !entity)) {
    return <NotFound />;
  }

  const contextualField = getContextualFieldInfo();

  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      <NavBarComponent />
      
      <div className="flex-1 pt-16">
        <div className="container max-w-6xl mx-auto py-8 px-4">
          {/* Hero Section */}
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
                    fallbackSrc={getEntityTypeFallbackImageSafe(entity?.type || 'product')}
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
                  {entity?.metadata?.verified && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
                      <Flag className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                    {getEntityTypeDisplaySafe(entity?.type || 'product')}
                  </Badge>
                </div>
                
                {entity?.description && (
                  <p className="text-muted-foreground mt-2">{entity.description}</p>
                )}
                
                {contextualField?.value && (
                  <div className="mt-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {contextualField.label}:
                    </span>
                    <span className="ml-2 text-sm">{contextualField.value}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card border-y dark:bg-card/50 py-4 mt-8">
            <div className="container max-w-6xl mx-auto px-4">
              <div className="flex flex-wrap items-center gap-6 justify-between">
                <div className="flex items-center gap-8">
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
                        <span className="text-lg font-bold">{stats.averageRating.toFixed(1)}</span>
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
          
          {/* Main Content */}
          <div className="flex flex-col md:flex-row gap-6 mt-6">
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
                
                <TabsContent value="recommendations" className="space-y-4 mt-2">
                  {!recommendations || recommendations.length === 0 ? (
                    <div className="py-12 text-center border rounded-lg bg-blue-50/30 dark:bg-blue-900/5">
                      <MessageSquareHeart className="h-12 w-12 mx-auto text-blue-300 dark:text-blue-700" />
                      <h3 className="font-medium text-lg mt-4">No recommendations yet</h3>
                      <p className="text-muted-foreground mt-2">
                        Be the first to recommend {entity?.name}!
                      </p>
                      <Button onClick={handleAddRecommendation} className="mt-4 gap-2" variant="outline">
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
                          Add Recommendation
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
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
                
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
                          Add Review
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
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="w-full md:w-72 lg:w-80 space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium">Share Your Experience</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={handleAddRecommendation}
                    className="w-full gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white"
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
                  
                  {/* Coming Soon: Social Sharing */}
                  <Button variant="secondary" className="w-full gap-2" disabled>
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium">About</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {entity?.venue && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Source</p>
                      <p className="text-sm">{entity.venue}</p>
                    </div>
                  )}
                  
                  {contextualField?.value && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {contextualField.label}
                      </p>
                      <p className="text-sm">{contextualField.value}</p>
                    </div>
                  )}
                  
                  {entity?.api_source === 'google_places' && entity.metadata?.formatted_address && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Address</p>
                      <p className="text-sm">{entity.metadata.formatted_address}</p>
                    </div>
                  )}
                  
                  {entity?.website_url && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Website</p>
                      <a href={entity.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
                        Visit Website
                      </a>
                    </div>
                  )}
                  
                  {entity?.created_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Added</p>
                      <p className="text-sm">{formatRelativeDate(entity.created_at)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
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
      
      <Footer />
      <BottomNavigation />
    </div>
  );
};

export default EntityDetail;
