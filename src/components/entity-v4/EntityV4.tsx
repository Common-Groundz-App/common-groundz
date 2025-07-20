import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';
import { useEntityDetailCached } from '@/hooks/use-entity-detail-cached';
import { useEntityHierarchy } from '@/hooks/use-entity-hierarchy';
import { getEntityTypeFallbackImage } from '@/services/entityTypeMapping';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitySave } from '@/hooks/use-entity-save';
import { useEntityShare } from '@/hooks/use-entity-share';
import { useEntityTimelineSummary } from '@/hooks/use-entity-timeline-summary';
import { useToast } from '@/hooks/use-toast';
import { EntityType } from '@/services/recommendation/types';
import { SafeUserProfile } from '@/types/profile';
import { MessageSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import ReviewForm from '@/components/profile/reviews/ReviewForm';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { EntityFollowerModal } from '@/components/entity/EntityFollowerModal';
import { EntityRecommendationModal } from '@/components/entity/EntityRecommendationModal';
import { TrustSummaryCard } from './TrustSummaryCard';
import { EntityHeader } from './EntityHeader';
import { ReviewsSection } from './ReviewsSection';

const EntityV4 = () => {
  const { slug } = useParams<{ slug: string }>();
  
  // Fetch real entity data
  const {
    entity,
    reviews,
    stats,
    isLoading,
    error
  } = useEntityDetailCached(slug || '');
  
  // Fetch entity hierarchy data
  const {
    parentEntity,
    isLoading: hierarchyLoading
  } = useEntityHierarchy(entity?.id || null);

  // Fetch circle rating data
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    circleRating,
    circleRatingCount,
    circleContributors,
    isLoading: isCircleRatingLoading
  } = useCircleRating(entity?.id || '');

  // Entity save functionality
  const {
    isSaved,
    saveCount,
    toggleSave,
    isLoading: isSaveLoading
  } = useEntitySave({
    entityId: entity?.id || '',
    enabled: !!entity?.id
  });

  // Entity share functionality
  const { shareEntity } = useEntityShare();

  // Timeline data
  const { summary: timelineData, isLoading: isTimelineLoading, error: timelineError } = useEntityTimelineSummary(entity?.id || null);

  // State for forms and modals
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);
  const [timelineReviewId, setTimelineReviewId] = useState<string | null>(null);
  const [isRecommendationModalOpen, setIsRecommendationModalOpen] = useState(false);

  // Memoized user review
  const userReview = React.useMemo(() => {
    if (!user || !reviews) return null;
    return reviews.find(review => review.user_id === user.id);
  }, [user, reviews]);

  // Get sidebar button configuration based on user's review status
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

  // Handler functions
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

  const handleReviewSubmit = async () => {
    try {
      setIsReviewFormOpen(false);
      toast({
        title: "Review submitted",
        description: "Your review has been added successfully"
      });
    } catch (error) {
      console.error('Error adding review:', error);
      toast({
        title: "Error",
        description: "Failed to submit review",
        variant: "destructive"
      });
    }
  };

  const handleTimelineUpdate = async () => {
    toast({
      title: "Timeline updated",
      description: "Your timeline update has been added successfully"
    });
  };

  const handleTimelineViewerClose = () => {
    setIsTimelineViewerOpen(false);
    setTimelineReviewId(null);
  };

  const handleShare = async () => {
    if (!entity) return;

    const entityUrl = `${window.location.origin}/entity/${entity.slug || entity.id}?v=4`;
    
    await shareEntity({
      name: entity.name,
      description: entity.description || undefined,
      url: entityUrl
    });
  };

  const sidebarButtonConfig = getSidebarButtonConfig();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <EntityPreviewToggle />
        <div className="flex-1 pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading entity...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (!isLoading && (error || !entity)) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <EntityPreviewToggle />
        <div className="flex-1 pt-16 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive mb-2">Entity Not Found</h2>
            <p className="text-muted-foreground">The entity you're looking for doesn't exist or has been removed.</p>
          </div>
        </div>
      </div>
    );
  }

  // Get entity image with fallback
  const entityImage = entity?.image_url || getEntityTypeFallbackImage(entity?.type || EntityType.Product);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        
        {/* Version Toggle */}
        <EntityPreviewToggle />
        
        {/* Main Content */}
        <div className="flex-1 pt-16">
          <div className="min-h-screen bg-gray-50">
            {/* Entity Header Section */}
            <EntityHeader
              entity={entity}
              parentEntity={parentEntity}
              hierarchyLoading={hierarchyLoading}
              entityImage={entityImage}
              stats={stats}
              user={user as unknown as SafeUserProfile | null}
              circleRating={circleRating}
              circleRatingCount={circleRatingCount}
              circleContributors={circleContributors}
              isSaved={isSaved}
              isSaveLoading={isSaveLoading}
              onShare={handleShare}
              onToggleSave={toggleSave}
              onRecommendationModalOpen={() => setIsRecommendationModalOpen(true)}
              onSidebarAction={sidebarButtonConfig.action}
              sidebarButtonConfig={sidebarButtonConfig}
            />

            <div className="max-w-7xl mx-auto px-4 py-8">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-3">
                  {/* Trust Summary */}
                  {entity && (
                    <TrustSummaryCard 
                      entityId={entity.id}
                      userId={user?.id || null}
                    />
                  )}

                  {/* Reviews Section */}
                  <ReviewsSection 
                    entityId={entity?.id || ''}
                    entityName={entity?.name || ''}
                  />

                  {/* Tabs Navigation */}
                  <Tabs defaultValue="overview" className="mb-8">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="products">Products</TabsTrigger>
                      <TabsTrigger value="posts">Posts</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6">
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="font-semibold mb-4">Company Overview</h3>
                          <p className="text-gray-600 leading-relaxed">
                            {entity?.name} is a leading health and wellness brand that has been at the forefront of providing 
                            science-backed nutrition solutions for over a decade. Founded with the mission to make 
                            premium supplements accessible to everyone, we focus on quality, transparency, and innovation.
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="products" className="mt-6">
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="font-semibold mb-4">Featured Products</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border rounded-lg p-4">
                              <h4 className="font-medium">Whey Protein Isolate</h4>
                              <p className="text-sm text-gray-600">Premium quality protein powder</p>
                              <div className="flex items-center gap-1 mt-2">
                                <div className="w-4 h-4 bg-yellow-400 rounded" />
                                <span className="text-sm">4.5 (234 reviews)</span>
                              </div>
                            </div>
                            <div className="border rounded-lg p-4">
                              <h4 className="font-medium">Complete Multivitamin</h4>
                              <p className="text-sm text-gray-600">Essential vitamins and minerals</p>
                              <div className="flex items-center gap-1 mt-2">
                                <div className="w-4 h-4 bg-yellow-400 rounded" />
                                <span className="text-sm">4.3 (189 reviews)</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="posts" className="mt-6">
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="font-semibold mb-4">Latest Posts</h3>
                          <div className="space-y-4">
                            <div className="border-b pb-4">
                              <h4 className="font-medium mb-2">New Product Launch: Plant-Based Protein</h4>
                              <p className="text-sm text-gray-600">We're excited to announce our latest addition to the Cosmix family...</p>
                              <span className="text-xs text-gray-400">2 days ago</span>
                            </div>
                            <div className="border-b pb-4">
                              <h4 className="font-medium mb-2">The Science Behind Whey Protein</h4>
                              <p className="text-sm text-gray-600">Understanding the benefits and optimal usage of whey protein...</p>
                              <span className="text-xs text-gray-400">1 week ago</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Sidebar - This will be extracted in the next phase */}
                <div className="lg:col-span-1">
                  {/* Sidebar content placeholder */}
                  <div className="space-y-6 sticky top-8">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-4">Business Info</h3>
                        <p className="text-sm text-gray-600">Sidebar content will be modularized in the next phase.</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Review Form Modal */}
        {isReviewFormOpen && entity && (
          <ReviewForm
            isOpen={isReviewFormOpen}
            onSubmit={handleReviewSubmit}
            onClose={() => setIsReviewFormOpen(false)}
            entity={{
              id: entity.id,
              name: entity.name,
              type: entity.type,
              image_url: entity.image_url,
              description: entity.description,
              venue: entity.venue
            }}
          />
        )}

        {/* Review Timeline Viewer Modal */}
        {isTimelineViewerOpen && timelineReviewId && entity && userReview && (
          <ReviewTimelineViewer
            isOpen={isTimelineViewerOpen}
            reviewId={timelineReviewId}
            reviewOwnerId={userReview.user_id}
            reviewTitle={userReview.title}
            initialRating={userReview.rating}
            onClose={handleTimelineViewerClose}
            onTimelineUpdate={handleTimelineUpdate}
          />
        )}

        {/* Recommendation Modal */}
        {isRecommendationModalOpen && entity && (
          <EntityRecommendationModal
            open={isRecommendationModalOpen}
            onOpenChange={setIsRecommendationModalOpen}
            entityId={entity.id}
            entityName={entity.name}
            totalRecommendationCount={stats?.recommendationCount || 0}
            circleRecommendationCount={stats?.circleRecommendationCount || 0}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default EntityV4;
