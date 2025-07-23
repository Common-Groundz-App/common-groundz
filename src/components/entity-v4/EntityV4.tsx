
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchEntityBySlug } from '@/services/entityService';
import { Entity } from '@/services/recommendation/types';
import { ReviewsSection } from './ReviewsSection';
import { EntityHeader } from './EntityHeader';
import { EntityOverview } from './EntityOverview';
import { EntityStatsSection } from './EntityStatsSection';
import Footer from '@/components/Footer';
import { ReviewWithUser } from '@/types/entities';
import { fetchEntityReviews } from '@/services/entityService';
import { useAuth } from '@/contexts/AuthContext';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { useToast } from '@/hooks/use-toast';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface EntityV4Props {
  entitySlug: string;
}

const EntityV4 = ({ entitySlug }: EntityV4Props) => {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedTimelineReview, setSelectedTimelineReview] = useState<ReviewWithUser | null>(null);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);
  const { followingIds } = useUserFollowing();

  // Show loading while authentication is still initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const loadEntity = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedEntity = await fetchEntityBySlug(entitySlug);
        if (!fetchedEntity) {
          setError('Entity not found');
          return;
        }
        setEntity(fetchedEntity);

        // Fetch reviews as well
        const fetchedReviews = await fetchEntityReviews(fetchedEntity.id, user?.id || null);
        setReviews(fetchedReviews);
      } catch (err: any) {
        console.error('Error fetching entity:', err);
        setError(err.message || 'Failed to load entity');
      } finally {
        setIsLoading(false);
      }
    };

    loadEntity();
  }, [entitySlug, user?.id]);

  const handleHelpfulClick = (reviewId: string) => {
    toast({
      title: 'Helpful clicked',
      description: `You marked review ${reviewId} as helpful.`,
    });
  };

  const handleTimelineClick = (review: ReviewWithUser) => {
    setSelectedTimelineReview(review);
    setIsTimelineViewerOpen(true);
  };

  const handleTimelineViewerClose = () => {
    setIsTimelineViewerOpen(false);
    setSelectedTimelineReview(null);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading entity...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      {/* <Navbar /> */}

      {/* Entity Header */}
      <EntityHeader 
        entity={entity!} 
        stats={null}
        entityImage={entity?.image_url || ''}
        entityData={{
          name: entity?.name || '',
          description: entity?.description || '',
          rating: 0,
          totalReviews: reviews.length,
          claimed: false,
          website: entity?.metadata?.website || ''
        }}
        onRecommendationModalOpen={() => {}}
        onReviewAction={() => {}}
        reviewActionConfig={{
          text: 'Write Review',
          icon: null,
          action: () => {},
          tooltip: null
        }}
      />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Section */}
        <EntityOverview entity={entity} />

        {/* Stats Section */}
        <EntityStatsSection entityId={entity?.id || ''} />
      </div>

      {/* Reviews Section with Network Integration */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReviewsSection
          reviews={reviews}
          entityName={entity?.name || ''}
          entityId={entity?.id || ''}
          userFollowingIds={followingIds}
          onHelpfulClick={handleHelpfulClick}
          onQuestionClick={() => console.log('Ask question clicked')}
        />
      </div>

      {/* Footer */}
      <Footer />

      {/* Timeline Viewer Modal */}
      {selectedTimelineReview && (
        <ReviewTimelineViewer
          isOpen={isTimelineViewerOpen}
          onClose={handleTimelineViewerClose}
          reviewId={selectedTimelineReview.id}
          reviewOwnerId={selectedTimelineReview.user_id}
          reviewTitle={selectedTimelineReview.title}
          initialRating={selectedTimelineReview.rating}
          onTimelineUpdate={() => {
            // Could refresh reviews here if needed
          }}
        />
      )}
    </div>
  );
};

export default EntityV4;
