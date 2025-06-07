import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, ExternalLink, Calendar, Users, TrendingUp, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEntityDetail } from '@/hooks/use-entity-detail';
import { useAuth } from '@/contexts/AuthContext';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import ReviewForm from '@/components/profile/reviews/ReviewForm';
import RecommendationForm from '@/components/recommendations/RecommendationForm';
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';
import { useRecommendations } from '@/hooks/use-recommendations';
import { useReviews } from '@/hooks/use-reviews';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import ReviewCard from '@/components/profile/reviews/ReviewCard';
import EntityDetailSkeleton from '@/components/entity/EntityDetailSkeleton';
import EntityMetadataCard from '@/components/entity/EntityMetadataCard';
import EntitySpecsCard from '@/components/entity/EntitySpecsCard';
import EntityRelatedCard from '@/components/entity/EntityRelatedCard';
import { ensureHttps } from '@/utils/urlUtils';

const EntityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const { handleImageUpload } = useRecommendationUploads();
  
  const {
    entity,
    isLoading,
    error,
    refreshEntity
  } = useEntityDetail(slug || '');

  const {
    recommendations,
    isLoading: recommendationsLoading,
    handleLike: handleRecommendationLike,
    handleSave: handleRecommendationSave,
    refreshRecommendations
  } = useRecommendations({ 
    profileUserId: entity?.created_by || undefined 
  });

  const {
    reviews,
    isLoading: reviewsLoading,
    handleLike: handleReviewLike,
    handleSave: handleReviewSave,
    refreshReviews
  } = useReviews({ 
    profileUserId: entity?.created_by || '' 
  });

  // Filter recommendations and reviews for this specific entity
  const entityRecommendations = recommendations?.filter(rec => rec.entity?.id === entity?.id) || [];
  const entityReviews = reviews?.filter(review => review.entity_id === entity?.id) || [];

  const handleReviewSubmit = async () => {
    await refreshReviews();
    await refreshEntity();
    setIsReviewFormOpen(false);
  };

  const handleRecommendationSubmit = async (values: any) => {
    // This function is kept but the form is hidden
    console.log('Recommendation form submitted (hidden):', values);
    setIsRecommendationFormOpen(false);
  };

  useEffect(() => {
    if (entity?.id) {
      // Increment view count or other analytics
    }
  }, [entity?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBarComponent />
        <div className="flex-1">
          <EntityDetailSkeleton />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBarComponent />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-muted-foreground mb-2">Entity Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The entity you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const secureImageUrl = entity.image_url ? ensureHttps(entity.image_url) : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      
      <div className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Entity Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Main Content */}
          <div className="md:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Entity Image */}
                  {secureImageUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={secureImageUrl}
                        alt={entity.name}
                        className="w-full md:w-48 h-48 object-cover rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Entity Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          {entity.type}
                        </Badge>
                        <h1 className="text-3xl font-bold mb-2">{entity.name}</h1>
                        {entity.venue && (
                          <p className="text-muted-foreground flex items-center gap-1 mb-2">
                            <MapPin className="h-4 w-4" />
                            {entity.venue}
                          </p>
                        )}
                      </div>
                    </div>

                    {entity.description && (
                      <p className="text-muted-foreground mb-4">{entity.description}</p>
                    )}

                    {/* Action Buttons - Hide Add Recommendation */}
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => setIsReviewFormOpen(true)}
                        className="bg-brand-orange hover:bg-brand-orange/90"
                      >
                        <Star className="h-4 w-4 mr-2" />
                        Add Review
                      </Button>
                      
                      {/* HIDDEN: Add Recommendation button - keeping code but hiding UI */}
                      {false && (
                        <Button 
                          variant="outline"
                          onClick={() => setIsRecommendationFormOpen(true)}
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Add Recommendation
                        </Button>
                      )}
                      
                      {entity.website_url && (
                        <Button 
                          variant="outline" 
                          onClick={() => window.open(entity.website_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Website
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <EntityMetadataCard entity={entity} />
            <EntitySpecsCard entity={entity} />
            <EntityRelatedCard entity={entity} />
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="recommendations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recommendations" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recommendations ({entityRecommendations.length})
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Reviews ({entityReviews.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Community Recommendations</h2>
                <Badge variant="outline">{entityRecommendations.length} recommendations</Badge>
              </div>
              
              {recommendationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-32 bg-muted rounded mb-4"></div>
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-3 bg-muted rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : entityRecommendations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entityRecommendations.map((recommendation) => (
                    <RecommendationCard
                      key={recommendation.id}
                      recommendation={recommendation}
                      onLike={handleRecommendationLike}
                      onSave={handleRecommendationSave}
                      onDeleted={refreshRecommendations}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No recommendations yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Be the first to create a 4+ star review to recommend this {entity.type.toLowerCase()}!
                    </p>
                    <Button 
                      onClick={() => setIsReviewFormOpen(true)}
                      className="bg-brand-orange hover:bg-brand-orange/90"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Write a Review
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Reviews</h2>
                <Badge variant="outline">{entityReviews.length} reviews</Badge>
              </div>
              
              {reviewsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-24 bg-muted rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : entityReviews.length > 0 ? (
                <div className="space-y-4">
                  {entityReviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      onLike={handleReviewLike}
                      onSave={handleReviewSave}
                      onDeleted={refreshReviews}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Share your experience with this {entity.type.toLowerCase()}!
                    </p>
                    <Button 
                      onClick={() => setIsReviewFormOpen(true)}
                      className="bg-brand-orange hover:bg-brand-orange/90"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Write the First Review
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />

      {/* Review Form Modal */}
      <ReviewForm
        isOpen={isReviewFormOpen}
        onClose={() => setIsReviewFormOpen(false)}
        onSubmit={handleReviewSubmit}
        entity={entity}
      />

      {/* HIDDEN: Recommendation Form Modal - keeping component but preventing it from opening */}
      {false && (
        <RecommendationForm
          isOpen={isRecommendationFormOpen}
          onClose={() => setIsRecommendationFormOpen(false)}
          onSubmit={handleRecommendationSubmit}
          onImageUpload={handleImageUpload}
          entity={entity}
        />
      )}
    </div>
  );
};

export default EntityDetail;
