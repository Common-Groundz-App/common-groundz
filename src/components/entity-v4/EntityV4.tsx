import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';
import { useEntityDetailCached } from '@/hooks/use-entity-detail-cached';
import { getEntityTypeFallbackImage } from '@/services/entityTypeMapping';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ReviewForm from '@/components/profile/reviews/ReviewForm';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { useEntityTimelineSummary } from '@/hooks/use-entity-timeline-summary';
import { useToast } from '@/hooks/use-toast';
import { EntityFollowerModal } from '@/components/entity/EntityFollowerModal';
import { EntityRecommendationModal } from '@/components/entity/EntityRecommendationModal';
import { EntityType } from '@/services/recommendation/types';
import { Button } from '@/components/ui/button';
import { EntityErrorBoundary } from '@/components/entity/EntityErrorBoundary';
import { resolveEntitySlug } from '@/services/entitySlugResolver';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';

// Imported extracted components
import { EntityHeader } from './EntityHeader';
import { TrustSummaryCard } from './TrustSummaryCard';
import { ReviewsSection } from './ReviewsSection';
import { EntitySidebar } from './EntitySidebar';
import { EntityTabsContent } from './EntityTabsContent';

const EntityV4 = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [slugResolution, setSlugResolution] = useState<{
    resolved: boolean;
    suggestion?: string;
  }>({ resolved: false });
  
  // Debug logging
  console.log('🔍 EntityV4 - Loading entity with slug:', slug);
  
  // Fetch real entity data with error boundary
  const {
    entity,
    reviews,
    stats,
    isLoading,
    error
  } = useEntityDetailCached(slug || '');

  // Handle entity not found - try slug resolution
  useEffect(() => {
    const handleEntityNotFound = async () => {
      if (error && !isLoading && slug && !slugResolution.resolved) {
        console.error('❌ EntityV4 - Entity not found for slug:', slug, 'Error:', error);
        
        // Try to resolve the slug
        const resolution = await resolveEntitySlug(slug);
        
        if (resolution.suggestion) {
          console.log('💡 Found slug suggestion:', resolution.suggestion);
          setSlugResolution({ resolved: true, suggestion: resolution.suggestion });
          // Redirect to suggested slug
          navigate(`/entity/${resolution.suggestion}?v=4`, { replace: true });
        } else {
          console.log('🔄 No suggestion found, trying V1...');
          setSlugResolution({ resolved: true });
          // Try to redirect to V1 if no suggestion found
          navigate(`/entity/${slug}?v=1`, { replace: true });
        }
      }
    };

    handleEntityNotFound();
  }, [error, isLoading, slug, navigate, slugResolution.resolved]);

  // Fetch circle rating data
  const { user } = useAuth();
  const { toast } = useToast();

  // Timeline data
  const { summary: timelineData, isLoading: isTimelineLoading, error: timelineError } = useEntityTimelineSummary(entity?.id || null);

  // State for forms and modals
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);
  const [timelineReviewId, setTimelineReviewId] = useState<string | null>(null);
  const [isRecommendationModalOpen, setIsRecommendationModalOpen] = useState(false);
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);

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

  const handleTimelineClick = (reviewId: string) => {
    setTimelineReviewId(reviewId);
    setIsTimelineViewerOpen(true);
  };

  const handleReviewSubmit = async () => {
    try {
      setIsReviewFormOpen(false);
      // Refresh data would be called here in a real implementation
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
    // Refresh data would be called here in a real implementation
    toast({
      title: "Timeline updated",
      description: "Your timeline update has been added successfully"
    });
  };

  const handleTimelineViewerClose = () => {
    setIsTimelineViewerOpen(false);
    setTimelineReviewId(null);
  };

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

  // Show error state with fallback
  if (error && !entity) {
    console.log('🚨 EntityV4 - Showing error state:', error);
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <EntityPreviewToggle />
        <div className="flex-1 pt-16 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Entity Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The entity "{slug}" could not be found. This might be due to a slug change.
            </p>
            <div className="space-x-2">
              <Button onClick={() => navigate(`/entity/${slug}?v=1`)}>
                Try Version 1
              </Button>
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If no entity but no error, still loading
  if (!entity) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <EntityPreviewToggle />
        <div className="flex-1 pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading entity...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EntityErrorBoundary slug={slug}>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col bg-background">
          <NavBarComponent />
          <EntityPreviewToggle />
          
          <div className="flex-1 pt-16 pb-20">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content - 8 columns */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Entity Header */}
                  <EntityHeader 
                    entity={entity}
                    stats={stats}
                    entityImage={entity.image_url || getEntityTypeFallbackImage(entity.type)}
                    entityData={{
                      name: entity.name,
                      description: entity.description || '',
                      rating: stats?.averageRating || 0,
                      totalReviews: stats?.reviewCount || 0,
                      claimed: entity.is_claimed || false,
                      website: entity.metadata?.website || ''
                    }}
                    onRecommendationModalOpen={() => setIsRecommendationModalOpen(true)}
                    onReviewAction={getSidebarButtonConfig().action}
                    reviewActionConfig={getSidebarButtonConfig()}
                  />
                  
                  {/* Trust Summary Card */}
                  <TrustSummaryCard 
                    entityId={entity.id}
                    userId={user?.id}
                  />
                  
                  {/* Tabs Content */}
                  <EntityTabsContent />
                </div>
                
                {/* Sidebar - 4 columns */}
                <div className="lg:col-span-4">
                  <EntitySidebar entity={entity} />
                </div>
              </div>
            </div>
            
            {/* Bottom Navigation Space */}
            <div className="h-20" />
          </div>
          
          <BottomNavigation />
          
          {/* Modals */}
          <EntityFollowerModal
            open={isFollowersModalOpen}
            onOpenChange={setIsFollowersModalOpen}
            entityId={entity?.id || ''}
            entityName={entity?.name}
            totalFollowersCount={0}
          />
          
          <EntityRecommendationModal
            open={isRecommendationModalOpen}
            onOpenChange={setIsRecommendationModalOpen}
            entityId={entity?.id || ''}
            entityName={entity?.name}
            totalRecommendationCount={stats?.recommendationCount || 0}
            circleRecommendationCount={stats?.circleRecommendationCount || 0}
          />
          
          {/* Review Form */}
          {isReviewFormOpen && (
            <ReviewForm
              isOpen={isReviewFormOpen}
              onClose={() => setIsReviewFormOpen(false)}
              onSubmit={handleReviewSubmit}
              entity={{
                id: entity.id,
                name: entity.name,
                type: entity.type,
                venue: entity.venue,
                image_url: entity.image_url,
                description: entity.description,
                metadata: entity.metadata
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
        </div>
      </TooltipProvider>
    </EntityErrorBoundary>
  );
};

export default EntityV4;