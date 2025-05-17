import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Star, Users, Calendar, Plus } from 'lucide-react';
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
      <div className="flex-1 pt-20">
        <div className="container max-w-4xl mx-auto py-6 px-4">
          {/* Entity Header */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Entity Image */}
                    <div className="w-full md:w-1/3">
                      <AspectRatio ratio={4/3} className="overflow-hidden rounded-md bg-muted/20">
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
                      <div>
                        <h1 className="text-2xl font-bold">{entity?.name}</h1>
                        <div className="flex flex-wrap gap-2 mt-2">
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
                      </div>
                      
                      {entity?.venue && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{entity.venue}</span>
                        </div>
                      )}
                      
                      {/* Rating and Stats */}
                      <div className="flex flex-wrap gap-4">
                        {stats.averageRating !== null && (
                          <div className="flex items-center gap-2">
                            <ConnectedRingsRating
                              value={stats.averageRating}
                              variant="badge"
                              minimal={true}
                              showValue={true}
                              size="sm"
                            />
                            <span className="text-sm text-muted-foreground">
                              from {stats.recommendationCount + stats.reviewCount} ratings
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {stats.recommendationCount} recommendations
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {stats.reviewCount} reviews
                          </span>
                        </div>
                      </div>
                      
                      {/* Description */}
                      {entity?.description && (
                        <p className="text-muted-foreground">{entity.description}</p>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button 
                          onClick={handleAddRecommendation}
                          className="flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Recommendation
                        </Button>
                        
                        <Button 
                          onClick={handleAddReview}
                          variant="outline" 
                          className="flex items-center gap-2"
                        >
                          <Star className="h-4 w-4" />
                          Add Review
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Content Tabs */}
          <Tabs 
            defaultValue="recommendations" 
            value={activeTab}
            onValueChange={setActiveTab}
            className="mt-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recommendations">
                Recommendations ({stats.recommendationCount})
              </TabsTrigger>
              <TabsTrigger value="reviews">
                Reviews ({stats.reviewCount})
              </TabsTrigger>
            </TabsList>
            
            {/* Recommendations Tab */}
            <TabsContent value="recommendations">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : !recommendations || recommendations.length === 0 ? (
                <div className="py-12 text-center">
                  <h3 className="font-medium text-lg">No recommendations yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Be the first to recommend {entity?.name}!
                  </p>
                  <Button onClick={handleAddRecommendation} className="mt-4">
                    Add Recommendation
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
                  </p>
                  {recommendations.map((recommendation) => (
                    <RecommendationCard
                      key={recommendation.id}
                      recommendation={recommendation}
                      onLike={() => handleRecommendationAction('like', recommendation.id)}
                      onSave={() => handleRecommendationAction('save', recommendation.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            
            {/* Reviews Tab */}
            <TabsContent value="reviews">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : !reviews || reviews.length === 0 ? (
                <div className="py-12 text-center">
                  <h3 className="font-medium text-lg">No reviews yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Be the first to review {entity?.name}!
                  </p>
                  <Button onClick={handleAddReview} className="mt-4">
                    Add Review
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                  </p>
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
              )}
            </TabsContent>
          </Tabs>

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
        </div>
      </div>
      <Footer />
      <BottomNavigation />
    </div>
  );
};

export default EntityDetail;
