
import { ReviewWithUser } from '@/types/entities';

export interface FilterOptions {
  search?: string;
  verified?: boolean;
  rating?: number;
  mostRecent?: boolean;
}

export const transformReviewForUI = (review: ReviewWithUser) => {
  return {
    id: review.id,
    name: review.user?.username || 'Unknown User',
    avatar: review.user?.avatar_url || '',
    rating: review.rating,
    date: new Date(review.created_at).toLocaleDateString(),
    title: review.title,
    content: review.description || '',
    verified: review.is_verified || false,
    helpful: review.likes || 0
  };
};

export const filterReviews = (reviews: ReviewWithUser[], filters: FilterOptions): ReviewWithUser[] => {
  return reviews.filter(review => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        review.title.toLowerCase().includes(searchLower) ||
        (review.description || '').toLowerCase().includes(searchLower) ||
        (review.user?.username || '').toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Verified filter
    if (filters.verified && !review.is_verified) {
      return false;
    }

    // Rating filter
    if (filters.rating && review.rating !== filters.rating) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    // Most recent filter affects sorting
    if (filters.mostRecent) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });
};

export const getTimelineReviews = (reviews: ReviewWithUser[]): ReviewWithUser[] => {
  return reviews.filter(review => review.has_timeline);
};

export const getCircleHighlightedReviews = (
  reviews: ReviewWithUser[], 
  userFollowingIds: string[]
): ReviewWithUser[] => {
  if (!userFollowingIds.length) return [];

  // Get reviews from users in the network with high ratings
  const circleReviews = reviews.filter(review => 
    userFollowingIds.includes(review.user_id) && 
    review.rating >= 4
  );

  // Sort by rating and recency
  return circleReviews
    .sort((a, b) => {
      // Higher rating first
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      // More recent first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 1); // Take only the top circle review
};

export const getNetworkReviewCount = (
  reviews: ReviewWithUser[], 
  userFollowingIds: string[]
): number => {
  return reviews.filter(review => 
    userFollowingIds.includes(review.user_id)
  ).length;
};

export const getNetworkRecommendationText = (
  reviews: ReviewWithUser[], 
  userFollowingIds: string[]
): string => {
  const networkReviews = reviews.filter(review => 
    userFollowingIds.includes(review.user_id)
  );
  
  if (networkReviews.length === 0) return '';
  if (networkReviews.length === 1) return '1 person you follow recommended this';
  return `${networkReviews.length} people you follow recommended this`;
};
