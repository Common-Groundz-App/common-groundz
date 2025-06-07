
import React from 'react';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

interface EmptyReviewsProps {
  isOwnProfile: boolean;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  type?: 'reviews' | 'dynamic';
  message?: string;
}

const EmptyReviews = ({ 
  isOwnProfile, 
  hasActiveFilter, 
  onClearFilters,
  type = 'reviews',
  message
}: EmptyReviewsProps) => {
  const defaultMessage = type === 'dynamic' 
    ? (isOwnProfile 
        ? "You haven't created any dynamic reviews yet. Share highly-rated experiences or add timeline updates!"
        : "This user hasn't created any dynamic reviews yet.")
    : (isOwnProfile 
        ? "You haven't written any reviews yet. Share your experiences to help others discover great places!"
        : "This user hasn't written any reviews yet.");

  return (
    <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg">
      <p className="text-lg mb-2">
        {type === 'dynamic' ? 'No dynamic reviews found' : 'No reviews found'}
      </p>
      <p className="text-sm">
        {hasActiveFilter 
          ? 'Try clearing your filters or add new reviews'
          : (message || defaultMessage)}
      </p>
      {hasActiveFilter && (
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={onClearFilters}
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
};

export default EmptyReviews;
