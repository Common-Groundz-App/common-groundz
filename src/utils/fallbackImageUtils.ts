
/**
 * Utilities for handling fallback images for recommendations and posts
 */

/**
 * Get a fallback image based on the recommendation category
 */
export const getCategoryFallbackImage = (category: string): string => {
  switch (category?.toLowerCase()) {
    case 'book':
    case 'books':
      return 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000';
    case 'movie':
    case 'movies':
    case 'tv':
    case 'tv show':
    case 'tv shows':
      return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1000';
    case 'place':
    case 'places':
    case 'location':
    case 'travel':
      return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=1000';
    case 'food':
    case 'restaurant':
    case 'restaurants':
      return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=1000';
    case 'music':
    case 'song':
    case 'songs':
    case 'album':
    case 'albums':
      return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1000';
    case 'product':
    case 'products':
    case 'item':
    case 'items':
      return 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&q=80&w=1000';
    case 'experience':
    case 'experiences':
      return 'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&q=80&w=1000';
    default:
      return 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&q=80&w=1000';
  }
};

/**
 * Get the best fallback image for a recommendation
 * Following the priority: media -> image_url -> entity image -> category fallback
 */
export const getRecommendationFallbackImage = (recommendation: any): string => {
  // Check if the recommendation has media
  if (recommendation.media && Array.isArray(recommendation.media) && recommendation.media.length > 0) {
    const validMedia = recommendation.media.find((item: any) => 
      item?.url && (item.type === 'image' || !item.type)
    );
    if (validMedia?.url) {
      return validMedia.url;
    }
  }
  
  // Check for legacy image_url
  if (recommendation.image_url) {
    return recommendation.image_url;
  }
  
  // Check if the recommendation has an entity with an image
  if (recommendation.entity && recommendation.entity.image_url) {
    return recommendation.entity.image_url;
  }
  
  // Fallback to category-based image
  return getCategoryFallbackImage(recommendation.category);
};
