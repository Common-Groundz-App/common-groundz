
import { ReviewWithUser } from '@/types/entities';

// Transform ReviewWithUser to format expected by UI components
export const transformReviewForUI = (review: ReviewWithUser) => ({
  id: parseInt(review.id.slice(-8), 16) || Math.floor(Math.random() * 1000000), // Convert UUID to number for UI compatibility
  name: review.user.username || 'Unknown User',
  avatar: review.user.avatar_url || `https://images.unsplash.com/photo-1494790108755-2616b612b515?w=50&h=50&fit=crop`,
  rating: review.rating,
  date: new Date(review.created_at).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }),
  title: review.title,
  content: review.description || '',
  verified: review.is_verified || false,
  helpful: review.likes || 0
});

// Filter reviews based on criteria
export const filterReviews = (reviews: ReviewWithUser[], filters: {
  search?: string;
  verified?: boolean;
  rating?: number;
  mostRecent?: boolean;
}) => {
  let filtered = [...reviews];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(review => 
      review.title.toLowerCase().includes(searchLower) ||
      (review.description || '').toLowerCase().includes(searchLower) ||
      (review.user.username || '').toLowerCase().includes(searchLower)
    );
  }

  // Verified filter
  if (filters.verified) {
    filtered = filtered.filter(review => review.is_verified);
  }

  // Rating filter
  if (filters.rating) {
    filtered = filtered.filter(review => review.rating >= filters.rating);
  }

  // Sort by most recent if requested
  if (filters.mostRecent) {
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return filtered;
};

// Identify timeline reviews
export const getTimelineReviews = (reviews: ReviewWithUser[]) => {
  return reviews.filter(review => review.has_timeline && (review.timeline_count || 0) > 0);
};

// Identify circle highlighted reviews (placeholder for network integration)
export const getCircleHighlightedReviews = (reviews: ReviewWithUser[], userFollowingIds: string[] = []) => {
  return reviews.filter(review => 
    userFollowingIds.includes(review.user_id) && 
    review.rating >= 4 && 
    review.likes && review.likes > 5
  );
};

// Generate mock timeline data structure for a review
export const generateTimelineDisplay = (review: ReviewWithUser) => {
  if (!review.has_timeline) return null;

  const timelineSteps = [
    {
      period: `${Math.floor(Math.random() * 6) + 1} months ago`,
      content: `Started using ${review.entity?.name || 'this product'}. Initial impressions are good.`
    },
    {
      period: `${Math.floor(Math.random() * 3) + 1} months ago`,
      content: `Seeing good results. ${review.rating >= 4 ? 'Experience is better than expected.' : 'Some mixed results so far.'}`
    },
    {
      period: '1 week ago',
      content: `${review.rating >= 4 ? 'Completely satisfied! Will definitely repurchase.' : 'Final thoughts: it\'s okay but not amazing.'} ${review.rating >= 4 ? '⭐'.repeat(Math.floor(review.latest_rating || review.rating)) : '⭐'.repeat(Math.floor(review.rating))}`
    }
  ];

  return timelineSteps;
};
