
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
import { EntityType, Entity } from '@/services/recommendation/types';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { useEntityHierarchy } from '@/hooks/use-entity-hierarchy';
import { useNavigate } from 'react-router-dom';
import { EntityDetailLoadingProgress } from '@/components/ui/entity-detail-loading-progress';
import { getHierarchicalEntityUrl } from '@/utils/entityUrlUtils';

// Imported extracted components
import { EntityHeader } from './EntityHeader';
import { MediaPreviewSection } from './MediaPreviewSection';
import { TrustSummaryCard } from './TrustSummaryCard';
import { ReviewsSection } from './ReviewsSection';
import { EntitySidebar } from './EntitySidebar';
import { EntityTabsContent } from './EntityTabsContent';
import Footer from '@/components/Footer';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';

const EntityV4 = () => {
  const { slug, parentSlug, childSlug } = useParams<{ 
    slug?: string; 
    parentSlug?: string; 
    childSlug?: string; 
  }>();
  const navigate = useNavigate();
  
  // Determine the entity slug to fetch - hierarchical takes precedence
  const entitySlug = React.useMemo(() => {
    if (parentSlug && childSlug) {
      return childSlug; // In hierarchical URLs, we fetch the child entity
    }
    return slug || '';
  }, [slug, parentSlug, childSlug]);
  
  // Fetch real entity data
  const {
    entity,
    reviews,
    stats,
    isLoading,
    error
  } = useEntityDetailCached(entitySlug);

  // Fetch entity hierarchy data (children/products and parent)
  const {
    entityWithChildren,
    parentEntity,
    isLoading: isLoadingHierarchy,
    error: hierarchyError,
    hasChildren,
    hasParent
  } = useEntityHierarchy(entity?.id || null);

  // Fetch circle rating data and user following data
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Get user's following list for circle functionality with improved error handling
  const { 
    data: userFollowingIds = [], 
    isLoading: isFollowingLoading, 
    error: followingError,
    isError: isFollowingError 
  } = useUserFollowing();

  // Enhanced debugging for all environments with authentication state tracking
  console.log('🔍 EntityV4 - Complete Authentication & Following Analysis:');
  console.log('  🔐 Auth State:', {
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    isAuthenticatedProperly: !!user?.id,
    authLoading,
    authInitialized: !authLoading
  });
  console.log('  👥 Following Hook State:', {
    userFollowingIds,
    userFollowingIdsType: typeof userFollowingIds,
    userFollowingIdsLength: userFollowingIds?.length || 0,
    userFollowingIdsIsArray: Array.isArray(userFollowingIds),
    isFollowingLoading,
    isFollowingError,
    followingError: followingError?.message || null
  });
  console.log('  🌍 Environment Context:', {
    currentUrl: typeof window !== 'undefined' ? window.location.href : 'SSR',
    hasLocalStorage: typeof window !== 'undefined' && !!window.localStorage,
    isAuthReady: !!user && !authLoading,
    isDataReady: !!user && !authLoading && !isFollowingLoading
  });

  // Timeline data
  const { summary: timelineData, isLoading: isTimelineLoading, error: timelineError } = useEntityTimelineSummary(entity?.id || null);

  // State for forms and modals
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);
  const [timelineReviewId, setTimelineReviewId] = useState<string | null>(null);
  const [isRecommendationModalOpen, setIsRecommendationModalOpen] = useState(false);
  
  // Loading step state for two-phase loading
  const [loadingStep, setLoadingStep] = useState(0);

  // Manage loading phases
  useEffect(() => {
    if (isLoading) {
      // Start with progress bar
      setLoadingStep(1);
      
      // Transition to spinner after 2.5 seconds
      const timer = setTimeout(() => {
        setLoadingStep(0);
      }, 2500);
      
      return () => clearTimeout(timer);
    } else {
      // Reset when not loading
      setLoadingStep(0);
    }
  }, [isLoading]);

  const userReview = React.useMemo(() => {
    if (!user || !reviews) return null;
    return reviews.find(review => review.user_id === user.id);
  }, [user, reviews]);

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

  // Function to scroll to Reviews & Social Proof section
  const scrollToReviewsSection = () => {
    console.log('🔄 Scroll to reviews triggered');
    
    // For mobile devices, add a small delay to ensure touch events complete
    const isMobile = window.innerWidth < 768;
    const delay = isMobile ? 100 : 0;
    
    setTimeout(() => {
      const reviewsSection = document.getElementById('reviews-section') ||
                            document.querySelector('[data-section="reviews"]');
      
      if (!reviewsSection) {
        // Fallback: try to find by text content
        const headings = document.querySelectorAll('h2');
        const reviewsHeading = Array.from(headings).find(h => 
          h.textContent?.includes('Reviews & Social Proof') || 
          h.textContent?.includes('Reviews')
        );
        
        if (reviewsHeading) {
          console.log('📍 Found reviews heading, scrolling...');
          
          // Use requestAnimationFrame for smoother mobile scrolling
          requestAnimationFrame(() => {
            reviewsHeading.scrollIntoView({ 
              behavior: isMobile ? 'auto' : 'smooth', // iOS Safari can have issues with smooth scroll
              block: 'start',
              inline: 'nearest'
            });
          });
        }
      } else {
        console.log('📍 Found reviews section, scrolling...');
        
        requestAnimationFrame(() => {
          reviewsSection.scrollIntoView({ 
            behavior: isMobile ? 'auto' : 'smooth',
            block: 'start',
            inline: 'nearest'
          });
        });
      }
    }, delay);
  };

  // Navigation handlers for child entities (V4 navigation)
  const handleViewChild = (child: Entity) => {
    if (entityWithChildren) {
      // Use hierarchical URL when viewing child from parent page
      const hierarchicalUrl = getHierarchicalEntityUrl(entityWithChildren, child);
      navigate(`${hierarchicalUrl}?v=4`);
    } else {
      // Fallback to single entity URL
      navigate(`/entity/${child.slug || child.id}?v=4`);
    }
  };

  const handleViewAllProducts = () => {
    // Could implement tab switching or modal here if needed
    toast({
      title: "View All Products",
      description: "Navigate to products tab for complete list",
    });
  };

  const reviewActionConfig = getSidebarButtonConfig();

  // Show loading state with two phases
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <EntityPreviewToggle />
        {loadingStep > 0 ? (
          // Phase 1: Factual progress bar (centered on screen)
          <div className="flex-1 flex items-center justify-center">
            <EntityDetailLoadingProgress 
              entityName={entity?.name}
              entityType={entity?.type}
            />
          </div>
        ) : (
          // Phase 2: Spinner loading (centered on screen)
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading entity...</p>
            </div>
          </div>
        )}
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
  
  // Prepare entity data using real data (for EntityHeader only)
  const entityData = {
    name: entity?.name || '',
    description: entity?.description || '',
    rating: stats?.averageRating || 0,
    totalReviews: stats?.reviewCount || 0,
    claimed: entity?.is_claimed || false,
    image: entityImage,
    website: entity?.website_url || '',
    location: entity?.venue || '',
    email: '',
    phone: ''
  };

  // Safely ensure userFollowingIds is always an array - with additional safeguards for external preview
  const validUserFollowingIds = Array.isArray(userFollowingIds) ? userFollowingIds : [];
  const isAuthenticated = !!user && !authLoading;
  const hasFollowingData = isAuthenticated && !isFollowingLoading && !isFollowingError;

  // Log final data being passed to ReviewsSection with authentication context
  console.log('🔍 Final data passed to ReviewsSection:', {
    reviewsCount: reviews?.length || 0,
    validUserFollowingIds,
    validUserFollowingIdsLength: validUserFollowingIds.length,
    shouldShowCircleHighlights: hasFollowingData && validUserFollowingIds.length > 0,
    isAuthenticated,
    hasFollowingData,
    authStatus: {
      user: !!user,
      authLoading,
      isFollowingLoading,
      isFollowingError
    }
  });

  return <TooltipProvider delayDuration={0}>
    <div className="min-h-screen flex flex-col bg-background">
      <NavBarComponent />
      
      {/* Version Toggle */}
      <EntityPreviewToggle />
      
      {/* Main Content */}
      <div className="flex-1 pt-16">
        <div className="min-h-screen bg-gray-50">
          {/* SECTION 1: Header & Primary Actions */}
          <EntityHeader
            entity={entity}
            stats={stats}
            entityImage={entityImage}
            entityData={entityData}
            onRecommendationModalOpen={() => setIsRecommendationModalOpen(true)}
            onReviewAction={reviewActionConfig.action}
            reviewActionConfig={reviewActionConfig}
            onRatingClick={scrollToReviewsSection}
          />

          {/* SECTION 2: Media Preview */}
          <MediaPreviewSection 
            entity={entity}
            onViewAllClick={() => {
              // Navigate to photos tab - you can customize this behavior
              const tabElement = document.querySelector('[data-value="photos"]');
              if (tabElement) {
                (tabElement as HTMLElement).click();
                // Scroll to tabs section
                setTimeout(() => {
                  const tabsSection = document.querySelector('[role="tabpanel"]');
                  if (tabsSection) {
                    tabsSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }, 100);
              }
            }}
          />

          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-3">
                {/* SECTION 3: Tabs Navigation */}
                <EntityTabsContent 
                  entity={entity} 
                  stats={stats}
                  entityWithChildren={entityWithChildren}
                  parentEntity={parentEntity}
                  onViewChild={handleViewChild}
                  onViewAllProducts={handleViewAllProducts}
                />

                {/* SECTION 4: Trust & Review Summary */}
                <TrustSummaryCard 
                  entityId={entity?.id || ''} 
                  userId={user?.id || null}
                />

                {/* SECTION 5: Reviews & Social Proof - Now with Enhanced Authentication Handling */}
                <ReviewsSection 
                  reviews={reviews}
                  entityName={entity?.name || ''}
                  entityId={entity?.id || ''}
                  onHelpfulClick={(reviewId) => {
                    console.log('Helpful clicked for review:', reviewId);
                  }}
                  onQuestionClick={() => {
                    console.log('Ask question clicked');
                  }}
                />
              </div>

              {/* SECTION 6: Info & Discovery Sidebar */}
              <div className="lg:col-span-1">
                {entity && <EntitySidebar entity={entity} />}
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

      {/* Footer */}
      <Footer />
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  </TooltipProvider>;
};

export default EntityV4;
