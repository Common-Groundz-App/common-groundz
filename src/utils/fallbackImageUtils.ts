
/**
 * Utilities for handling fallback images for recommendations and posts
 */

/**
 * Get a fallback image based on the recommendation category
 */
export const getCategoryFallbackImage = (category: string): string => {
  if (!category) return 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&q=80&w=1000';
  
  switch (category.toLowerCase()) {
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
 * Safely check if an object has a valid array property
 */
const hasValidArray = (obj: any, prop: string): boolean => {
  return obj && 
         obj[prop] && 
         Array.isArray(obj[prop]) && 
         obj[prop].length > 0;
};

/**
 * Get the best fallback image for a recommendation
 * Following the priority: media -> image_url -> entity image -> category fallback
 */
export const getRecommendationFallbackImage = (recommendation: any): string => {
  // Safety check
  if (!recommendation) {
    console.log('getRecommendationFallbackImage: Missing recommendation object');
    return getCategoryFallbackImage('');
  }
  
  // Check if the recommendation has media
  if (hasValidArray(recommendation, 'media')) {
    const validMedia = recommendation.media.find((item: any) => 
      item?.url && (item.type === 'image' || !item.type)
    );
    if (validMedia?.url) {
      console.log('Using media URL:', validMedia.url);
      return validMedia.url;
    }
  }
  
  // Check for legacy image_url
  if (recommendation.image_url) {
    console.log('Using legacy image_url:', recommendation.image_url);
    return recommendation.image_url;
  }
  
  // Check if the recommendation has an entity with an image
  if (recommendation.entity && recommendation.entity.image_url) {
    console.log('Using entity image_url:', recommendation.entity.image_url);
    return recommendation.entity.image_url;
  }
  
  // Fallback to category-based image
  const fallbackImage = getCategoryFallbackImage(recommendation.category);
  console.log('Using category fallback image for', recommendation.category, ':', fallbackImage);
  return fallbackImage;
};

