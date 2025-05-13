
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import EmptyReviews from './reviews/EmptyReviews';
import { useReviews } from '@/hooks/use-reviews';
import ReviewCard from './reviews/ReviewCard';
import ReviewForm from './reviews/ReviewForm';

interface ProfileReviewsProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfileReviews = ({ profileUserId, isOwnProfile }: ProfileReviewsProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const {
    reviews,
    isLoading,
    error,
    handleLike,
    handleSave,
    refreshReviews,
    convertToRecommendation,
  } = useReviews({ profileUserId });

  // Create a wrapped version of refreshReviews that returns void
  const handleRefreshReviews = useCallback(async () => {
    await refreshReviews();
    // Return void to satisfy the type requirements
  }, [refreshReviews]);

  if (isLoading) {
    return (
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div 
            key={i} 
            className="w-full h-60 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800/50 dark:to-gray-800/30 animate-pulse rounded-xl shadow-sm"
          ></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 rounded-xl bg-destructive/5 p-6">
        <p className="text-destructive">Error loading reviews. Please try again.</p>
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <EmptyReviews 
          isOwnProfile={isOwnProfile} 
          onCreateReview={() => setIsFormOpen(true)} 
        />
        {isFormOpen && isOwnProfile && (
          <ReviewForm 
            isOpen={isFormOpen} 
            onClose={() => setIsFormOpen(false)} 
            onSubmit={handleRefreshReviews}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {isOwnProfile && (
        <div className="flex justify-end mb-6">
          <Button 
            onClick={() => setIsFormOpen(true)} 
            variant="gradient"
            className="flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-300"
          >
            <PlusCircle className="h-4 w-4" />
            Add Review
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {reviews.map(review => (
          <ReviewCard 
            key={review.id}
            review={review}
            onLike={handleLike}
            onSave={handleSave}
            onConvert={isOwnProfile ? convertToRecommendation : undefined}
            refreshReviews={handleRefreshReviews}
          />
        ))}
      </div>
      
      {isFormOpen && isOwnProfile && (
        <ReviewForm 
          isOpen={isFormOpen} 
          onClose={() => setIsFormOpen(false)} 
          onSubmit={handleRefreshReviews}
        />
      )}
    </div>
  );
};

export default ProfileReviews;
