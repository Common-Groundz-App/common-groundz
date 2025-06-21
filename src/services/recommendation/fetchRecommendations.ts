
import { supabase } from '@/integrations/supabase/client';
import { Recommendation, RecommendationCategory } from '../recommendation/types';
import { EntityTypeString, mapStringToEntityType } from '@/hooks/feed/api/types';

// Function to fetch user recommendations with optimized queries
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
    console.log('fetchUserRecommendations called with:', {
      userId, profileUserId, category, sortBy, page, limit
    });
    
    // Build query with JOIN to get entity and profile data in one call
    let query = supabase
      .from('recommendations')
      .select(`
        *,
        entity:entities(*),
        profiles:profiles!recommendations_user_id_fkey(id, username, avatar_url)
      `, { count: 'exact' })
      .eq('user_id', profileUserId);
    
    // Add category filter if specified
    if (category) {
      let categoryValue: string;
      if (typeof category === 'string') {
        categoryValue = category.toLowerCase();
      } else {
        categoryValue = String(category).toLowerCase();
      }
      query = query.eq('category', categoryValue as any);
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

    // Execute the optimized query
    console.log('Executing optimized recommendations query with JOINs');
    const { data: recommendations, error, count } = await query;

    if (error) {
      console.error('Error fetching recommendations:', error);
      return { recommendations: [], count: 0, hasMore: false };
    }
    
    console.log(`Found ${recommendations?.length || 0} recommendations`);

    if (recommendations && recommendations.length > 0) {
      // Get recommendation IDs for batch like operations
      const recommendationIds = recommendations.map(rec => rec.id);
      
      // Separate the batch operations to avoid complex type issues
      let likeCountsData: any = null;
      let userLikesData: any = null;
      let userSavesData: any = null;
      
      try {
        // Get like counts for all recommendations
        const likeCountsResult = await supabase.rpc('get_recommendation_likes_by_ids', {
          p_recommendation_ids: recommendationIds
        });
        likeCountsData = likeCountsResult;
        
        // Add user-specific queries if user is logged in
        if (userId) {
          const [likesResult, savesResult] = await Promise.all([
            // Get user likes
            supabase
              .from('recommendation_likes')
              .select('recommendation_id')
              .eq('user_id', userId)
              .in('recommendation_id', recommendationIds),
            
            // Get user saves
            supabase
              .from('recommendation_saves')
              .select('recommendation_id')
              .eq('user_id', userId)
              .in('recommendation_id', recommendationIds)
          ]);
          
          userLikesData = likesResult;
          userSavesData = savesResult;
        }
      } catch (batchError) {
        console.error('Error in batch operations:', batchError);
        // Continue with empty data rather than failing completely
      }
      
      // Process results with proper error handling
      const likeCountMap = new Map();
      if (likeCountsData?.data) {
        likeCountsData.data.forEach((item: any) => {
          likeCountMap.set(item.recommendation_id, item.like_count || 0);
        });
      }
      
      const likedIds = new Set(
        userLikesData?.data?.map((like: any) => like.recommendation_id) || []
      );
      
      const savedIds = new Set(
        userSavesData?.data?.map((save: any) => save.recommendation_id) || []
      );

      // Process recommendations with all fetched data
      const processedRecommendations = recommendations.map(rec => {
        // Extract profile data with proper null checks
        const profile = rec.profiles as any || {};
        const username = profile?.username || null;
        const avatar_url = profile?.avatar_url || null;
        
        // Get entity data (already fetched via JOIN)
        const entity = rec.entity || null;
        
        // Get interaction data
        const likes = likeCountMap.get(rec.id) || 0;
        const isLiked = userId ? likedIds.has(rec.id) : false;
        const isSaved = userId ? savedIds.has(rec.id) : false;
        
        const processed = {
          ...rec,
          entity,
          likes,
          isLiked,
          isSaved,
          username,
          avatar_url,
        };
        
        // Clean up nested data
        delete processed.profiles;
        
        return processed as unknown as Recommendation;
      });

      console.log(`Processed ${processedRecommendations.length} recommendations with optimized queries`);

      return {
        recommendations: processedRecommendations,
        count: count || 0,
        hasMore: (count || 0) > from + processedRecommendations.length
      };
    }

    return {
      recommendations: [],
      count: count || 0,
      hasMore: false
    };
  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    return { recommendations: [], count: 0, hasMore: false };
  }
};
