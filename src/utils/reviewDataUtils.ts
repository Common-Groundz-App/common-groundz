
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
  title: review.subtitle || '',
  content: review.description || '',
  verified: review.is_verified || false,
  helpful: review.likes || 0,
  media: (review.media || []).map(item => ({
    id: item.id || '',
    url: item.url,
    type: item.type,
    thumbnail_url: item.thumbnail_url,
    order: 0, // Default order since common.ts MediaItem doesn't have this
    caption: item.alt_text,
    alt: item.alt_text,
    is_deleted: false,
    width: (item as any).width,
    height: (item as any).height,
    orientation: (item as any).orientation,
    source: (item as any).source
  }))
});

// Filter reviews based on criteria
export const filterReviews = (reviews: ReviewWithUser[], filters: {
  search?: string;
  verified?: boolean;
  rating?: number;
  starFilter?: 'exact' | 'range';
  minRating?: number;
  maxRating?: number;
  networkOnly?: boolean;
  hasTimeline?: boolean;
  hasMedia?: boolean;
  sortBy?: 'mostRecent' | 'highestRated' | 'lowestRated';
}, userFollowingIds: string[] = []) => {
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

  // Network only filter - show only reviews from followed users
  if (filters.networkOnly && userFollowingIds.length > 0) {
    console.log('Applying network filter. Following IDs:', userFollowingIds);
    filtered = filtered.filter(review => {
      const isFromNetwork = userFollowingIds.includes(review.user_id);
      console.log(`Review from ${review.user.username} (${review.user_id}): ${isFromNetwork ? 'IN' : 'NOT IN'} network`);
      return isFromNetwork;
    });
  }

  // Verified filter
  if (filters.verified) {
    filtered = filtered.filter(review => review.is_verified);
  }

  // Star rating filters
  if (filters.rating && filters.starFilter === 'exact') {
    filtered = filtered.filter(review => review.rating === filters.rating);
  } else if (filters.rating && filters.starFilter === 'range') {
    filtered = filtered.filter(review => review.rating >= filters.rating);
  } else if (filters.minRating && filters.maxRating) {
    filtered = filtered.filter(review => 
      review.rating >= filters.minRating && review.rating <= filters.maxRating
    );
  } else if (filters.rating) {
    // Legacy support - default to range
    filtered = filtered.filter(review => review.rating >= filters.rating);
  }

  // Timeline filter
  if (filters.hasTimeline) {
    filtered = filtered.filter(review => review.has_timeline && (review.timeline_count || 0) > 0);
  }

  // Media filter
  if (filters.hasMedia) {
    filtered = filtered.filter(review => review.media && review.media.length > 0);
  }

  // Apply sorting
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'mostRecent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'highestRated':
          // Use latest_rating if available, fall back to rating
          const aRating = a.latest_rating || a.rating;
          const bRating = b.latest_rating || b.rating;
          return bRating - aRating;
        case 'lowestRated':
          // Use latest_rating if available, fall back to rating
          const aRatingLow = a.latest_rating || a.rating;
          const bRatingLow = b.latest_rating || b.rating;
          return aRatingLow - bRatingLow;
        default:
          return 0;
      }
    });
  }

  return filtered;
};

// Identify timeline reviews
export const getTimelineReviews = (reviews: ReviewWithUser[]) => {
  return reviews.filter(review => review.has_timeline && (review.timeline_count || 0) > 0);
};

// Simplified circle highlighted reviews - show ANY review from followed users
export const getCircleHighlightedReviews = (reviews: ReviewWithUser[], userFollowingIds: string[] = []) => {
  console.log('Getting circle highlighted reviews');
  console.log('User following IDs:', userFollowingIds);
  console.log('Total reviews:', reviews.length);
  
  // If user has no following, no circle highlights
  if (userFollowingIds.length === 0) {
    console.log('No following users - no circle highlights');
    return [];
  }

  // Find ALL reviews from followed users (no restrictions on rating, engagement, or recency)
  const circleReviews = reviews.filter(review => {
    const isFromFollowedUser = userFollowingIds.includes(review.user_id);
    
    console.log(`Review by ${review.user.username} (${review.user_id}):`);
    console.log(`  - Rating: ${review.rating}`);
    console.log(`  - Likes: ${review.likes || 0}`);
    console.log(`  - From followed user: ${isFromFollowedUser}`);
    
    return isFromFollowedUser;
  });

  console.log(`Found ${circleReviews.length} circle highlighted reviews`);

  // Sort by recency first (most recent from your network), then by rating
  const sortedCircleReviews = circleReviews.sort((a, b) => {
    // Primary sort: most recent first
    const dateComparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateComparison !== 0) return dateComparison;
    
    // Secondary sort: higher rating first
    return b.rating - a.rating;
  });

  console.log('Sorted circle reviews:', sortedCircleReviews.map(r => ({
    user: r.user.username,
    rating: r.rating,
    date: r.created_at
  })));

  return sortedCircleReviews;
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

// Get network context for a review
export const getNetworkContext = (review: ReviewWithUser, userFollowingIds: string[]) => {
  const isFromNetwork = userFollowingIds.includes(review.user_id);
  
  if (!isFromNetwork) return null;
  
  return {
    isFromNetwork: true,
    context: 'from your network',
    isTrending: (review.likes || 0) >= 5 && review.rating >= 4
  };
};
