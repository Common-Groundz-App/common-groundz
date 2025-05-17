import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Star, Users, Calendar, Plus, Share2, Flag, MessageSquare, MessageSquareHeart } from 'lucide-react';
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

const EntityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('recommendations');
  const { handleImageUpload } = useRecommendationUploads();
  
  // New state variables to control the visibility of forms
  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  
  const {
    entity,
    recommendations,
    reviews,
    stats,
    isLoading,
    error,
    refreshData
  } = useEntityDetail(slug || '');
  
  // Debug logging for recommendations and reviews
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

  // Handle entity not found or deleted
  if (!isLoading && (error || !entity)) {
    return <NotFound />;
  }

  // Get category-based fallback image for entities
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
  
  // Handle recommendation form submission
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
  
  // Handle review form submission
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

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1 pt-16">
        {/* Hero Entity Header Section */}
        <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
          {isLoading ? (
            <div className="container max-w-6xl mx-auto py-8 px-4">
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
          ) : (
            <div className="container max-w-6xl mx-auto py-8 px-4">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Entity Image */}
                <div className="w-full md:w-1/3 lg:w-1/4">
                  <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg border shadow-md bg-muted/20">
                    <ImageWithFallback
                      src={entity?.image_url || ''}
                      alt={entity?.name || 'Entity image'}
                      className="w-full h-full object-cover"
                      fallbackSrc={getEntityTypeFallbackImage(entity?.type || 'place')}
                    />
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
                          {/* Category name would be fetched here */}
                          Category
                        </Badge>
                      )}
                    </div>
                    {entity?.venue && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{entity.venue}</span>
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
          )}
        </div>
        
        {/* Rating Summary Bar */}
        <div className="bg-card border-y dark:bg-card/50 py-4">
          <div className="container max-w-6xl mx-auto px-4">
            {isLoading ? (
              <div className="flex justify-between">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-40" />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-6 justify-between">
                {/* Rating Display */}
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
            )}
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
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-48 w-full" />
                      <Skeleton className="h-48 w-full" />
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
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-48 w-full" />
                      <Skeleton className="h-48 w-full" />
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
              {!isLoading && (
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
              )}
              
              {/* Entity Info Card */}
              {!isLoading && entity && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Entity Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <div className="font-medium">Type</div>
                      <div className="text-muted-foreground">{entity.type}</div>
                    </div>
                    
                    {entity.venue && (
                      <div className="text-sm">
                        <div className="font-medium">Location</div>
                        <div className="text-muted-foreground">{entity.venue}</div>
                      </div>
                    )}
                    
                    {entity.created_at && (
                      <div className="text-sm">
                        <div className="font-medium">Added</div>
                        <div className="text-muted-foreground">
                          {formatRelativeDate(entity.created_at)}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Placeholder for Related Entities */}
              {!isLoading && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Related Entities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Coming soon...</p>
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
      
      <Footer />
      <BottomNavigation />
    </div>
  );
};

export default EntityDetail;
