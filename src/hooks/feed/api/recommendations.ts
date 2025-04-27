
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams, RecommendationFeedItem } from '../../feed/types';
import { fetchProfiles } from './profiles';
import { createMap } from '../api/utils';

// Fetch recommendations from database based on query parameters
export const fetchRecommendations = async (
  { userId, page = 0, itemsPerPage = 10 }: FeedQueryParams, 
  followingIds?: string[]
): Promise<{ recommendations: any[] }> => {
  try {
    let query = supabase
      .from('recommendations')
      .select('*')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);
      
    // If following IDs provided, only get recommendations from those users
    if (followingIds && followingIds.length > 0) {
      query = query.in('user_id', followingIds);
    }
    
    const { data: recommendationsData, error } = await query;
    
    if (error) throw error;
    
    return { recommendations: recommendationsData || [] };
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }
};

// Get recommendation like counts for a list of recommendation IDs
export const getRecommendationLikeCounts = async (recommendationIds: string[]): Promise<Map<string, number>> => {
  if (!recommendationIds.length) return new Map<string, number>();
  
  try {
    const { data: likesData, error } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds);
    
    if (error) throw error;
    
    const likeCounts = new Map<string, number>();
    
    // Count likes per recommendation
    if (likesData) {
      // Use reduce to count occurrences
      likesData.forEach((item: any) => {
        const recId = item.recommendation_id;
        const currentCount = likeCounts.get(recId) || 0;
        likeCounts.set(recId, currentCount + 1);
      });
    }
    
    return likeCounts;
  } catch (error) {
    console.error('Error counting recommendation likes:', error);
    return new Map<string, number>();
  }
};

// Get user likes for recommendations
export const getUserRecommendationLikes = async (recommendationIds: string[], userId: string): Promise<Set<string>> => {
  if (!recommendationIds.length) return new Set<string>();
  
  try {
    const { data: userLikesData, error } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .eq('user_id', userId)
      .in('recommendation_id', recommendationIds);
    
    if (error) throw error;
    
    const userLikedRecommendations = new Set<string>();
    
    if (userLikesData) {
      userLikesData.forEach((item: any) => {
        userLikedRecommendations.add(item.recommendation_id);
      });
    }
    
    return userLikedRecommendations;
  } catch (error) {
    console.error('Error fetching user recommendation likes:', error);
    return new Set<string>();
  }
};

// Get user saves for recommendations
export const getUserRecommendationSaves = async (recommendationIds: string[], userId: string): Promise<Set<string>> => {
  if (!recommendationIds.length) return new Set<string>();
  
  try {
    const { data: userSavesData, error } = await supabase
      .from('recommendation_saves')
      .select('recommendation_id')
      .eq('user_id', userId)
      .in('recommendation_id', recommendationIds);
    
    if (error) throw error;
    
    const userSavedRecommendations = new Set<string>();
    
    if (userSavesData) {
      userSavesData.forEach((item: any) => {
        userSavedRecommendations.add(item.recommendation_id);
      });
    }
    
    return userSavedRecommendations;
  } catch (error) {
    console.error('Error fetching user recommendation saves:', error);
    return new Set<string>();
  }
};

// Process recommendations data with additional metadata
export const processRecommendations = async (
  recommendationsData: any[], 
  userId: string
): Promise<RecommendationFeedItem[]> => {
  if (!recommendationsData.length) return [];
  
  try {
    // Get recommendation IDs for fetching related data
    const recommendationIds = recommendationsData.map(rec => rec.id);
    
    // Fetch user profiles
    const userIds = recommendationsData.map(rec => rec.user_id);
    const { data: profilesData } = await fetchProfiles(userIds);
    
    // Create lookup map for profiles
    const profilesMap = createMap(profilesData, 'id');
    
    // Get recommendation likes count
    const likeCounts = await getRecommendationLikeCounts(recommendationIds);
    
    // Get user likes and saves for recommendations
    const userLikedRecommendations = await getUserRecommendationLikes(recommendationIds, userId);
    const userSavedRecommendations = await getUserRecommendationSaves(recommendationIds, userId);
    
    // Format the recommendations as feed items
    const processedRecommendations = recommendationsData.map(rec => {
      // Get profile data
      const profile = profilesMap.get(rec.user_id);
      const username = profile?.username || null;
      const avatar_url = profile?.avatar_url || null;
      
      // Get recommendation metadata
      const likes = likeCounts.get(rec.id) || 0;
      const isLiked = userLikedRecommendations.has(rec.id);
      const isSaved = userSavedRecommendations.has(rec.id);
      
      // Ensure the comment_count is set
      const comment_count = rec.comment_count || 0;
      
      return {
        ...rec,
        username,
        avatar_url,
        is_post: false,
        likes,
        is_liked: isLiked,
        is_saved: isSaved,
        comment_count
      };
    });
    
    return processedRecommendations;
  } catch (error) {
    console.error('Error processing recommendations:', error);
    throw error;
  }
};
