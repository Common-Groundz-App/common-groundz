
import { ReviewWithUser } from '@/types/entities';
import { ReviewUpdate } from '@/services/reviewService';
import { formatRelativeDate } from '@/utils/dateUtils';

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

// Transform real timeline updates into display format
export const transformTimelineUpdates = (review: ReviewWithUser, updates: ReviewUpdate[]) => {
  if (!review.has_timeline || updates.length === 0) return null;

  // Sort updates by creation date (oldest first)
  const sortedUpdates = [...updates].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const timelineSteps = [
    {
      period: formatRelativeDate(review.created_at),
      content: review.description || `Started using ${review.entity?.name || 'this product'}.`,
      rating: review.rating,
      type: 'initial' as const
    }
  ];

  // Add each update as a timeline step
  sortedUpdates.forEach((update, index) => {
    timelineSteps.push({
      period: formatRelativeDate(update.created_at),
      content: update.comment,
      rating: update.rating || undefined,
      type: 'update' as const
    });
  });

  return timelineSteps;
};

// Calculate timeline progression (initial vs latest rating)
export const calculateTimelineProgression = (review: ReviewWithUser, updates: ReviewUpdate[]) => {
  const initialRating = review.rating;
  
  // Find the latest update with a rating
  const updatesWithRating = updates
    .filter(u => u.rating !== null)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const latestRating = updatesWithRating.length > 0 
    ? updatesWithRating[0].rating!
    : review.latest_rating || initialRating;

  return {
    initialRating,
    latestRating,
    updateCount: updates.length,
    hasProgression: latestRating !== initialRating
  };
};

// Legacy function - kept for backward compatibility but deprecated
export const generateTimelineDisplay = (review: ReviewWithUser) => {
  console.warn('generateTimelineDisplay is deprecated. Use transformTimelineUpdates with real data instead.');
  return null;
};
