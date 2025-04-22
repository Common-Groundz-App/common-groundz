
import React, { useEffect, useRef } from 'react';
import { useProfileData } from '@/hooks/use-profile-data';
import ReviewCard from './reviews/ReviewCard';
import EmptyReviews from './reviews/EmptyReviews';
import { toast } from '@/hooks/use-toast';

interface ProfileReviewsProps {
  profileUserId?: string; 
  isOwnProfile: boolean;
  highlightReviewId?: string | null;
}

const ProfileReviews = ({ profileUserId, isOwnProfile, highlightReviewId }: ProfileReviewsProps) => {
  const { reviews, isLoading } = useProfileData(profileUserId).reviews;
  const highlightedReviewRef = useRef<HTMLDivElement>(null);

  // Effect to scroll to highlighted review
  useEffect(() => {
    if (highlightReviewId && reviews && reviews.length > 0 && !isLoading) {
      // Check if the review exists
      const reviewExists = reviews.some(review => review.id === highlightReviewId);
      
      if (reviewExists) {
        // Short delay to ensure DOM is updated
        setTimeout(() => {
          if (highlightedReviewRef.current) {
            highlightedReviewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Add a highlight effect
            highlightedReviewRef.current.classList.add('ring-2', 'ring-primary', 'ring-opacity-50');
            setTimeout(() => {
              highlightedReviewRef.current?.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50');
            }, 2000);
          }
        }, 100);
      } else {
        toast({
          title: "Review not found",
          description: "The review you're looking for might have been deleted or is not visible.",
          variant: "destructive",
          duration: 3000
        });
      }
    }
  }, [highlightReviewId, reviews, isLoading]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md"></div>
        ))}
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return <EmptyReviews 
      isOwnProfile={isOwnProfile} 
      onCreateReview={() => {
        const event = new CustomEvent('open-create-review-dialog');
        window.dispatchEvent(event);
      }} 
    />;
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div
          key={review.id}
          ref={review.id === highlightReviewId ? highlightedReviewRef : null}
          className={`transition-all duration-300 rounded-lg ${review.id === highlightReviewId ? 'bg-accent/30' : ''}`}
        >
          <ReviewCard 
            review={review} 
            onLike={() => {}}
            onSave={() => {}}
            refreshReviews={async () => {}}
            isOwnReview={isOwnProfile}
          />
        </div>
      ))}
    </div>
  );
};

export default ProfileReviews;
