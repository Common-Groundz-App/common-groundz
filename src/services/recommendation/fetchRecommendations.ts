
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
    console.log('fetchUserRecommendations called with:', {
      userId, profileUserId, category, sortBy, page, limit
    });
    
    // Build query without nested select - this avoids the relationship error
    let query = supabase
      .from('recommendations')
      .select('*, recommendation_likes(count)', { count: 'exact' })
      .eq('user_id', profileUserId);
    
    // Add category filter if specified
    if (category) {
      // Handle both enum and string categories
      let categoryValue: string;
      if (typeof category === 'string') {
        categoryValue = category.toLowerCase();
      } else {
        // This is a fallback for any value that might be passed
        categoryValue = String(category).toLowerCase();
      }
      
      // Use 'eq' with the string value
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

    // Execute the query for recommendations
    console.log('Executing recommendations query');
    const { data: recommendations, error, count } = await query;

    if (error) {
      console.error('Error fetching recommendations:', error);
      return { recommendations: [], count: 0, hasMore: false };
    }
    
    console.log(`Found ${recommendations?.length || 0} recommendations`);

    // If we have recommendations, fetch related entity data and profile data separately
    if (recommendations && recommendations.length > 0) {
      // Get list of entity IDs we need to fetch (filtering out nulls)
      const entityIds = recommendations
        .map(rec => rec.entity_id)
        .filter(id => id !== null) as string[];

      // Get list of user IDs to fetch profiles
      const userIds = [...new Set(recommendations.map(rec => rec.user_id))];
      
      // Fetch entities if we have any entity IDs
      let entities: Record<string, any> = {};
      if (entityIds.length > 0) {
        const { data: entitiesData, error: entitiesError } = await supabase
          .from('entities')
          .select('*')
          .in('id', entityIds);
          
        if (entitiesError) {
          console.error('Error fetching entities:', entitiesError);
        } else if (entitiesData) {
          // Create a lookup map of entities by ID
          entities = entitiesData.reduce((acc, entity) => {
            acc[entity.id] = entity;
            return acc;
          }, {} as Record<string, any>);
          
          console.log(`Fetched ${entitiesData.length} entities`);
        }
      }
      
      // Fetch user profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }
      
      // Create a lookup map of profiles by user ID
      const profiles = profilesData?.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>) || {};
      
      console.log(`Fetched ${profilesData?.length || 0} profiles`);

      // Process recommendations to integrate entity and profile data
      const processedRecommendations = recommendations.map(rec => {
        // Extract like count
        const likes = rec.recommendation_likes?.[0]?.count || 0;
        
        // Get profile data for this recommendation's user_id
        const profile = profiles[rec.user_id] || {};
        const username = profile?.username || null;
        const avatar_url = profile?.avatar_url || null;
        
        // Get entity data if available
        const entity = rec.entity_id ? entities[rec.entity_id] || null : null;
        
        // Add isLiked as false by default (will be updated on client)
        const processed = {
          ...rec,
          entity,
          likes,
          isLiked: false,
          username,
          avatar_url,
        };
        
        // Clean up nested data that's already been extracted
        delete processed.recommendation_likes;
        
        return processed as unknown as Recommendation;
      });

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
