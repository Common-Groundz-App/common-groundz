
import { supabase } from '@/integrations/supabase/client';
import { Recommendation, RecommendationCategory } from '../recommendation/types';
import { EntityTypeString, mapStringToEntityType } from '@/hooks/feed/api/types';

// Function to fetch user recommendations
export const fetchUserRecommendations = async (
  userId: string | null,
  profileUserId: string,
  category?: RecommendationCategory | string,
  sortBy: 'latest' | 'oldest' | 'highest_rated' = 'latest',
  page: number = 1,
  limit: number = 10
): Promise<{
  recommendations: Recommendation[],
  count: number,
  hasMore: boolean
}> => {
  try {
    // Build the base query
    let query = supabase
      .from('recommendations')
      .select(`
        *,
        recommendation_likes(count),
        entity(*),
        profiles!recommendations_user_id_fkey(username, avatar_url)
      `, { count: 'exact' })
      .eq('user_id', profileUserId);
    
    // Add category filter if specified - use string as is for database
    if (category) {
      // Handle both enum and string categories
      let categoryValue: string;
      if (typeof category === 'string') {
        categoryValue = category.toLowerCase();
      } else {
        // This is a fallback for any value that might be passed
        categoryValue = String(category).toLowerCase();
      }
        
      query = query.eq('category', categoryValue);
    }

    // Add sorting
    switch (sortBy) {
      case 'latest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'highest_rated':
        query = query.order('rating', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Execute the query
    const { data: recommendations, error, count } = await query;

    if (error) {
      console.error('Error fetching user recommendations:', error);
      return { recommendations: [], count: 0, hasMore: false };
    }

    // Process recommendations to add like and save counts
    const processedRecommendations = recommendations?.map(rec => {
      // For each recommendation, extract the like count
      const likes = rec.recommendation_likes?.[0]?.count || 0;
      
      // Extract profile information safely
      const profileData = rec.profiles || {};
      const username = profileData.username || null;
      const avatar_url = profileData.avatar_url || null;
      
      // Add isLiked as false by default (will be updated in FE if needed)
      const processed = {
        ...rec,
        likes,
        isLiked: false,
        username,
        avatar_url,
      };
      
      // Clean up nested data that's already been extracted
      delete processed.recommendation_likes;
      delete processed.profiles;
      
      return processed as unknown as Recommendation;
    }) || [];

    return {
      recommendations: processedRecommendations,
      count: count || 0,
      hasMore: (count || 0) > from + processedRecommendations.length
    };
  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    return { recommendations: [], count: 0, hasMore: false };
  }
};
