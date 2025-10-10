
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
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
import { useEntitySiblings } from '@/hooks/use-entity-siblings';
import { useNavigate } from 'react-router-dom';
import { EntityV4LoadingWrapper } from '@/components/entity/EntityV4LoadingWrapper';
import { getHierarchicalEntityUrl, getEntityUrlWithParent } from '@/utils/entityUrlUtils';
import { useEntityImageRefresh } from '@/hooks/recommendations/use-entity-refresh';
import { useQueryClient } from '@tanstack/react-query';

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
    isLoading,       // Now only true on initial load
    isRefetching,    // True during background refetch
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

  // Fetch siblings when entity has a parent
  const {
    siblings,
    isLoading: isLoadingSiblings,
    error: siblingsError
  } = useEntitySiblings(
    entity?.id || null,
    entity?.parent_id || null
  );

  // Fetch circle rating data and user following data
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Initialize image refresh hook and query client
  const { refreshEntityImage, isRefreshing } = useEntityImageRefresh();
  const queryClient = useQueryClient();
  
  // Determine if this entity's hero image can be refreshed
  // This mirrors the logic in useEntityImageRefresh.prepareEdgeFunctionRequest
  const canRefreshHeroImage = React.useMemo(() => {
    if (!entity) return false;
    
    const apiSource = entity.api_source;
    const metadata = entity.metadata as any;
    
    // Google Places - refreshable if we have place_id OR photo_reference
    if (apiSource === 'google_places') {
      return !!(metadata?.place_id || metadata?.photo_reference);
    }
    
    // Google Books - needs google_books_id in metadata
    if (apiSource === 'google_books') {
      return !!metadata?.google_books_id;
    }
    
    // TMDB - needs tmdb_id in metadata
    if (apiSource === 'tmdb') {
      return !!metadata?.tmdb_id;
    }
    
    // OMDb - needs imdb_id in metadata
    if (apiSource === 'omdb') {
      return !!metadata?.imdb_id;
    }
    
    // All other entities (products, websites, etc.) - can attempt refresh if image_url exists
    // This matches the fallback case in prepareEdgeFunctionRequest
    return !!entity.image_url;
  }, [entity]);
  
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
      navigate(`${getEntityUrlWithParent(child)}?v=4`);
    }
  };

  const handleViewAllProducts = () => {
    // Could implement tab switching or modal here if needed
    toast({
      title: "View All Products",
      description: "Navigate to products tab for complete list",
    });
  };

  const handleRefreshHeroImage = async () => {
    if (!entity) {
      toast({
        title: 'Error',
        description: 'Entity not found',
        variant: 'destructive'
      });
      return;
    }

    console.log('🔄 Refreshing hero image for entity:', entity.id, 'API source:', entity.api_source);

    try {
      // Use metadata fields with fallback to top-level fields for Google Places entities
      const placeId = entity.metadata?.place_id ?? entity.api_ref;
      const photoReference = entity.metadata?.photo_reference ?? entity.photo_reference;

      // Call the refresh hook with entity's Place ID and photo reference
      const newImageUrl = await refreshEntityImage(
        entity.id,
        entity.api_source === 'google_places' ? placeId : undefined,
        photoReference
      );

      if (newImageUrl) {
        toast({
          title: 'Image refreshed',
          description: 'The entity image has been successfully updated.',
        });

        // GUARDRAIL #1: Match the two-part key used by useEntityDetailCached
        await queryClient.invalidateQueries({
          queryKey: ['entity-detail', entitySlug]
        });
      } else {
        toast({
          title: 'Refresh failed',
          description: 'Could not fetch a new image. The entity may not have image data available.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Error refreshing hero image:', error);
      toast({
        title: 'Refresh failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  const reviewActionConfig = getSidebarButtonConfig();

  // Double-safety: Only show skeleton when truly no cached data exists.
  // Even if React Query briefly reports isLoading=true during edge cases,
  // if we have a cached entity, show content (prevents flash).
  if (isLoading && !entity) {
    return (
      <EntityV4LoadingWrapper 
        entityName={entity?.name ?? entitySlug}
        entityType={entity?.type ?? 'product'}
      />
    );
  }

  // Show error state
  if (!isLoading && (error || !entity)) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <div className="flex-1 pt-8 flex items-center justify-center">
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
      
      {/* Main Content */}
      <div className="flex-1 pt-8">
        {/* Subtle indicator during background refetch */}
        {isRefetching && (
          <div className="fixed top-16 right-4 z-50 animate-fade-in">
            <div className="bg-primary/10 backdrop-blur-sm text-primary px-3 py-1.5 rounded-full text-xs font-medium shadow-sm flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Refreshing...
            </div>
          </div>
        )}
        
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
            onRefreshHeroImage={canRefreshHeroImage ? handleRefreshHeroImage : undefined}
            isRefreshingImage={canRefreshHeroImage ? isRefreshing : false}
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
                  siblings={siblings}
                  parentEntity={parentEntity}
                  isLoadingSiblings={isLoadingSiblings}
                  onViewSibling={(sibling) => {
                    if (parentEntity && sibling.slug) {
                      const hierarchicalUrl = getHierarchicalEntityUrl(parentEntity, sibling);
                      navigate(`${hierarchicalUrl}?v=4`);
                    } else {
                      navigate(`/entity/${sibling.slug || sibling.id}?v=4`);
                    }
                  }}
                />
              </div>

              {/* SECTION 6: Info & Discovery Sidebar */}
              <div className="lg:col-span-1">
                {entity && (
                  <EntitySidebar 
                    entity={entity}
                    childEntities={entityWithChildren?.children || []}
                    isLoadingChildren={isLoadingHierarchy}
                    onViewChild={handleViewChild}
                    parentEntity={parentEntity}
                    isLoadingParent={isLoadingHierarchy}
                  />
                )}
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
