
/**
 * Utilities for handling fallback images for recommendations and posts
 */

import { getEntityTypeFallbackImage } from '@/services/entityTypeHelpers';

/**
 * Get a fallback image based on the recommendation category
 * Delegates to canonical helper which has all type mappings
 */
export const getCategoryFallbackImage = (category: string): string => {
  return getEntityTypeFallbackImage(category);
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

