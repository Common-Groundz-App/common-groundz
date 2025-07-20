
import React, { useState, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';
import { useEntityDetailCached } from '@/hooks/use-entity-detail-cached';
import { useEntityHierarchy } from '@/hooks/use-entity-hierarchy';
import { getEntityTypeFallbackImage } from '@/services/entityTypeMapping';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitySave } from '@/hooks/use-entity-save';
import { useEntityTimelineSummary } from '@/hooks/use-entity-timeline-summary';
import { useToast } from '@/hooks/use-toast';
import { useEntityActions } from '@/hooks/useEntityActions';
import { EntityType } from '@/services/recommendation/types';
import { SafeUserProfile } from '@/types/profile';
import { TooltipProvider } from "@/components/ui/tooltip";
import ReviewForm from '@/components/profile/reviews/ReviewForm';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { EntityFollowerModal } from '@/components/entity/EntityFollowerModal';
import { EntityRecommendationModal } from '@/components/entity/EntityRecommendationModal';
import { TrustSummaryCard } from './TrustSummaryCard';
import { EntityHeader } from './EntityHeader';
import { EntityActions } from './EntityActions';
import { EntitySkeleton } from './EntitySkeleton';
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load non-critical components
const ReviewsSection = lazy(() => import('./ReviewsSection').then(module => ({ default: module.ReviewsSection })));
const EntitySidebar = lazy(() => import('./EntitySidebar').then(module => ({ default: module.EntitySidebar })));
const EntityTabsContent = lazy(() => import('./TabsContent').then(module => ({ default: module.EntityTabsContent })));

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

  // Custom hooks for actions
  const {
    getSidebarButtonConfig,
    handleAddReview,
    handleStartTimeline,
    handleShare
  } = useEntityActions({
    entity,
    user: user as unknown as SafeUserProfile | null,
    userReview,
    onReviewFormOpen: () => setIsReviewFormOpen(true),
    onTimelineStart: (reviewId: string) => {
      setTimelineReviewId(reviewId);
      setIsTimelineViewerOpen(true);
    }
  });

  // Handler functions
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

  const sidebarButtonConfig = getSidebarButtonConfig();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <EntityPreviewToggle />
        <div className="flex-1 pt-16">
          <EntitySkeleton />
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

                  {/* Reviews Section - Lazy Loaded */}
                  <Suspense fallback={
                    <div className="mt-8">
                      <Skeleton className="h-8 w-48 mb-4" />
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="p-6 border rounded-lg space-y-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-10 rounded-full" />
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-16" />
                              </div>
                            </div>
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                          </div>
                        ))}
                      </div>
                    </div>
                  }>
                    <ReviewsSection 
                      entityId={entity?.id || ''}
                      entityName={entity?.name || ''}
                    />
                  </Suspense>

                  {/* Tabs Content - Lazy Loaded */}
                  <Suspense fallback={
                    <div className="mt-8">
                      <div className="flex gap-4 mb-6">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-20" />
                        <Skeleton className="h-10 w-16" />
                      </div>
                      <Skeleton className="h-64 w-full rounded-lg" />
                    </div>
                  }>
                    {entity && <EntityTabsContent entity={entity} />}
                  </Suspense>
                </div>

                {/* Sidebar - Lazy Loaded */}
                <div className="lg:col-span-1">
                  <Suspense fallback={
                    <div className="space-y-6">
                      <div className="p-4 border rounded-lg">
                        <Skeleton className="h-10 w-full mb-4" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="p-6 border rounded-lg space-y-4">
                        <Skeleton className="h-6 w-32 mb-4" />
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="flex items-start gap-3">
                            <Skeleton className="h-4 w-4 mt-1" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  }>
                    {entity && (
                      <EntitySidebar 
                        entity={entity}
                        isFollowing={false}
                        followerCount={Math.floor(Math.random() * 1000) + 100}
                        onFollowToggle={() => console.log('Follow toggled')}
                      />
                    )}
                  </Suspense>
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
