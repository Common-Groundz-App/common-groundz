
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Users, Calendar, Plus, Share2, Flag, MessageSquare, MessageSquareHeart, RefreshCw, Image, Clock, User, Book, Film, Globe, Phone } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import { useOptimizedEntityDetail } from '@/hooks/use-optimized-entity-detail';
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
import { EntityDetailSkeleton } from '@/components/ui/entity-detail-skeleton';

const OptimizedEntityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('recommendations');
  const { handleImageUpload } = useRecommendationUploads();
  
  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  
  const { refreshEntityImage, isRefreshing, isEntityImageMigrated } = useEntityImageRefresh();
  
  const {
    entity,
    recommendations,
    reviews,
    stats,
    isLoading,
    isInitialLoad,
    loadingStates,
    error,
    refreshData
  } = useOptimizedEntityDetail(slug || '');

  // Show skeleton during initial load
  if (isInitialLoad) {
    return <EntityDetailSkeleton />;
  }

  // Handle entity not found or deleted
  if (!isLoading && (error || !entity)) {
    return <NotFound />;
  }

  const getEntityTypeFallbackImage = (type: string): string => {
    const fallbacks: Record<string, string> = {
      'movie': 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
      'book': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
      'food': 'https://images.unsplash.com/photo-1555939594-58d7698950b',
      'place': 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
      'product': 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    };
    
    return fallbacks[type] || 'https://images.unsplash.com/photo-1501854140801-50d01698950b';
  };

  const getLocationDisplay = () => {
    if (!entity) return null;
    
    if (entity.api_source === 'google_places' && entity.metadata?.formatted_address) {
      return entity.metadata.formatted_address;
    }
    
    return entity.venue;
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

  // Enhanced metadata display
  const renderEnhancedMetadata = () => {
    if (!entity?.metadata) return null;

    const metadata = entity.metadata;
    const items = [];

    // Movie metadata
    if (entity.api_source === 'omdb') {
      if (metadata.Director) {
        items.push(
          <div key="director" className="text-sm">
            <div className="font-medium">Director</div>
            <div className="text-muted-foreground">{metadata.Director}</div>
          </div>
        );
      }
      if (metadata.Actors) {
        items.push(
          <div key="actors" className="text-sm">
            <div className="font-medium">Cast</div>
            <div className="text-muted-foreground">{metadata.Actors}</div>
          </div>
        );
      }
      if (metadata.Genre) {
        items.push(
          <div key="genre" className="text-sm">
            <div className="font-medium">Genre</div>
            <div className="text-muted-foreground">{metadata.Genre}</div>
          </div>
        );
      }
      if (metadata.Runtime) {
        items.push(
          <div key="runtime" className="text-sm">
            <div className="font-medium">Runtime</div>
            <div className="text-muted-foreground">{metadata.Runtime}</div>
          </div>
        );
      }
    }

    // Book metadata
    if (entity.api_source === 'google_books') {
      if (metadata.authors?.length > 0) {
        items.push(
          <div key="authors" className="text-sm">
            <div className="font-medium">Authors</div>
            <div className="text-muted-foreground">{metadata.authors.join(', ')}</div>
          </div>
        );
      }
      if (metadata.publisher) {
        items.push(
          <div key="publisher" className="text-sm">
            <div className="font-medium">Publisher</div>
            <div className="text-muted-foreground">{metadata.publisher}</div>
          </div>
        );
      }
      if (metadata.publishedDate) {
        items.push(
          <div key="published" className="text-sm">
            <div className="font-medium">Published</div>
            <div className="text-muted-foreground">{metadata.publishedDate}</div>
          </div>
        );
      }
      if (metadata.pageCount) {
        items.push(
          <div key="pages" className="text-sm">
            <div className="font-medium">Pages</div>
            <div className="text-muted-foreground">{metadata.pageCount}</div>
          </div>
        );
      }
    }

    // Place metadata
    if (entity.api_source === 'google_places') {
      if (metadata.formatted_phone_number) {
        items.push(
          <div key="phone" className="text-sm">
            <div className="font-medium">Phone</div>
            <div className="text-muted-foreground">{metadata.formatted_phone_number}</div>
          </div>
        );
      }
      if (metadata.website) {
        items.push(
          <div key="website" className="text-sm">
            <div className="font-medium">Website</div>
            <div className="text-muted-foreground">
              <a href={metadata.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {metadata.website}
              </a>
            </div>
          </div>
        );
      }
      if (metadata.rating) {
        items.push(
          <div key="google-rating" className="text-sm">
            <div className="font-medium">Google Rating</div>
            <div className="text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {metadata.rating} ({metadata.user_ratings_total} reviews)
            </div>
          </div>
        );
      }
    }

    return items;
  };

  if (!entity) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1 pt-16">
        {/* Hero Entity Header Section */}
        <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
          <div className="container max-w-6xl mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Entity Image */}
              <div className="w-full md:w-1/3 lg:w-1/4">
                <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg border shadow-md bg-muted/20 relative group">
                  <ImageWithFallback
                    src={entity?.image_url || ''}
                    alt={entity?.name || 'Entity image'}
                    className="w-full h-full object-cover"
                    fallbackSrc={getEntityTypeFallbackImage(entity?.type || 'place')}
                  />
                  
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
                    {entity?.api_source && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {entity.api_source === 'omdb' ? 'IMDb' : 
                         entity.api_source === 'google_books' ? 'Google Books' :
                         entity.api_source === 'google_places' ? 'Google Places' :
                         entity.api_source}
                      </Badge>
                    )}
                  </div>
                  {getLocationDisplay() && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{getLocationDisplay()}</span>
                    </div>
                  )}
                  
                  {entity?.description && (
                    <p className="text-muted-foreground mt-2">{entity.description}</p>
                  )}

                  {/* Enhanced metadata display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {renderEnhancedMetadata()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Rating Summary Bar */}
        <div className="bg-card border-y dark:bg-card/50 py-4">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="flex flex-wrap items-center gap-6 justify-between">
              <div className="flex items-center gap-4">
                {stats.averageRating !== null ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center bg-violet-50 dark:bg-violet-900/20 rounded-full p-2 h-16 w-16">
                      <ConnectedRingsRating
                        value={stats.averageRating}
                        variant="badge"
                        showValue={true}
                        size="md"
                      />
                    </div>
                    <div>
                      <div className="font-semibold">Overall Rating</div>
                      <div className="text-sm text-muted-foreground">
                        Based on {stats.recommendationCount + stats.reviewCount} ratings
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">No ratings yet</div>
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
                    {loadingStates.recommendations && <Clock className="h-3 w-3 ml-2 animate-spin" />}
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="py-3">
                    Reviews ({stats.reviewCount})
                    {loadingStates.reviews && <Clock className="h-3 w-3 ml-2 animate-spin" />}
                  </TabsTrigger>
                </TabsList>
                
                {/* Recommendations Tab */}
                <TabsContent value="recommendations" className="space-y-4 mt-2">
                  {loadingStates.recommendations ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                          <CardHeader>
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 bg-muted rounded-full" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-24 bg-muted rounded" />
                                <div className="h-3 w-32 bg-muted rounded" />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="h-4 w-full bg-muted rounded mb-2" />
                            <div className="h-4 w-4/5 bg-muted rounded mb-2" />
                            <div className="h-4 w-3/5 bg-muted rounded" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : !recommendations || recommendations.length === 0 ? (
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
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
                
                {/* Reviews Tab */}
                <TabsContent value="reviews" className="space-y-4 mt-2">
                  {loadingStates.reviews ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                          <CardHeader>
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 bg-muted rounded-full" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-24 bg-muted rounded" />
                                <div className="h-3 w-32 bg-muted rounded" />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="h-4 w-full bg-muted rounded mb-2" />
                            <div className="h-4 w-4/5 bg-muted rounded mb-2" />
                            <div className="h-4 w-3/5 bg-muted rounded" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : !reviews || reviews.length === 0 ? (
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
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Right Sidebar */}
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
              
              {/* Enhanced Entity Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium">Entity Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <div className="font-medium">Type</div>
                    <div className="text-muted-foreground">{entity.type}</div>
                  </div>
                  
                  {getLocationDisplay() && (
                    <div className="text-sm">
                      <div className="font-medium">Location</div>
                      <div className="text-muted-foreground">{getLocationDisplay()}</div>
                    </div>
                  )}
                  
                  {entity.api_source && (
                    <div className="text-sm">
                      <div className="font-medium">Data Source</div>
                      <div className="text-muted-foreground">
                        {entity.api_source === 'omdb' ? 'IMDb/OMDb' : 
                         entity.api_source === 'google_books' ? 'Google Books' :
                         entity.api_source === 'google_places' ? 'Google Places' :
                         entity.api_source}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-sm">
                    <div className="font-medium">Added</div>
                    <div className="text-muted-foreground">
                      Recently added
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Related Entities Placeholder */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium">Related Entities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Coming soon...</p>
                </CardContent>
              </Card>
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
      
      <Footer />
      <BottomNavigation />
    </div>
  );
};

export default OptimizedEntityDetail;
