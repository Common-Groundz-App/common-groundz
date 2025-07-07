
import { supabase } from '@/integrations/supabase/client';
import { Recommendation, RecommendationCategory } from '../recommendation/types';
import { EntityTypeString, mapStringToEntityType } from '@/hooks/feed/api/types';
import { attachProfilesToEntities } from '@/services/enhancedUnifiedProfileService';

// Function to fetch user recommendations with optimized queries and enhanced unified profile service
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
    
    // Build query without JOIN to avoid complexity
    let query = supabase
      .from('recommendations')
      .select(`
        *,
        entity:entities(*)
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

    // Execute the query
    console.log('Executing recommendations query');
    const { data: recommendations, error, count } = await query;

    if (error) {
      console.error('Error fetching recommendations:', error);
      return { recommendations: [], count: 0, hasMore: false };
    }
    
    console.log(`Found ${recommendations?.length || 0} recommendations`);

    if (recommendations && recommendations.length > 0) {
      // Attach profiles using enhanced unified service
      const recommendationsWithProfiles = await attachProfilesToEntities(recommendations);
      
      // Get recommendation IDs for batch operations
      const recommendationIds = recommendations.map(rec => rec.id);
      
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
      const processedRecommendations = recommendationsWithProfiles.map(rec => {
        // Get entity data (already fetched via JOIN)
        const entity = rec.entity || null;
        
        // Get interaction data
        const likes = likeCountMap.get(rec.id) || 0;
        const isLiked = userId ? likedIds.has(rec.id) : false;
        const isSaved = userId ? savedIds.has(rec.id) : false;
        
        // Transform to legacy format for backward compatibility
        const processed = {
          ...rec,
          entity,
          likes,
          isLiked,
          isSaved,
          // Legacy properties for backward compatibility
          username: rec.user.displayName,
          avatar_url: rec.user.avatar_url,
        };
        
        return processed as unknown as Recommendation;
      });

      console.log(`Processed ${processedRecommendations.length} recommendations with enhanced unified profile service`);

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
