
import React, { useState } from 'react';
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

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto grid gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-60 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
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
            onSubmit={refreshReviews}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {isOwnProfile && (
        <div className="flex justify-end mb-6">
          <Button 
            onClick={() => setIsFormOpen(true)} 
            className="bg-brand-orange hover:bg-brand-orange/90 text-white"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Review
          </Button>
        </div>
      )}

      <div className="grid gap-6">
        {reviews.map(review => (
          <ReviewCard 
            key={review.id}
            review={review}
            onLike={handleLike}
            onSave={handleSave}
            onConvert={isOwnProfile ? convertToRecommendation : undefined}
            refreshReviews={refreshReviews}
          />
        ))}
      </div>
      
      {isFormOpen && isOwnProfile && (
        <ReviewForm 
          isOpen={isFormOpen} 
          onClose={() => setIsFormOpen(false)} 
          onSubmit={refreshReviews}
        />
      )}
    </div>
  );
};

export default ProfileReviews;
