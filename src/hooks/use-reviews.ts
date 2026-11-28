
import { useCallback } from 'react';
import { useReviewsFetch } from './reviews/use-reviews-fetch';
import { useReviewHelpful } from '@/components/reviews/helpful/ReviewHelpfulContext';

interface UseReviewsProps {
  profileUserId: string;
}

export const useReviews = ({ profileUserId }: UseReviewsProps) => {
  const helpful = useReviewHelpful();
  const { 
    data: reviews,
    isLoading,
    error,
    refetch
  } = useReviewsFetch({ profileUserId });

  const handleLike = (id: string) => {
    const review = reviews?.find(r => r.id === id);
    if (review) helpful?.toggle(review, 'profile_review_card');
  };

  const refreshReviews = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    reviews,
    isLoading,
    error,
    handleLike,
    refreshReviews
  };
};
