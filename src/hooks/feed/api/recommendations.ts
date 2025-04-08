
import { supabase } from '@/integrations/supabase/client';
import { FeedItem, FeedQueryParams } from '../types';
import { fetchProfiles } from './profiles';
import { createMap } from './utils';

// Fetch recommendations with pagination
export const fetchRecommendations = async (
  { page, itemsPerPage }: FeedQueryParams,
  followingIds?: string[] // Optional parameter to filter by following users
) => {
  try {
    const recFrom = page * itemsPerPage;
    const recTo = recFrom + itemsPerPage - 1;
    
    let query = supabase
      .from('recommendations')
      .select('*')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
    
    // Filter by following users if provided
    if (followingIds && followingIds.length > 0) {
      query = query.in('user_id', followingIds);
    }
    
    const { data: recsData, error: recsError } = await query;
      
    if (recsError) throw recsError;
    if (!recsData || recsData.length === 0) return { recommendations: [], userIds: [] };
    
    // Extract user IDs for profile fetching
    const userIds = recsData.map(rec => rec.user_id);
    
    return { recommendations: recsData, userIds };
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }
};

// Process recommendation data with user profiles
export const processRecommendations = async (
  recsData: any[],
  userId: string
): Promise<FeedItem[]> => {
  if (!recsData.length) return [];
  
  try {
    // Get user profiles
    const userIds = recsData.map(rec => rec.user_id);
    const { data: profilesData } = await fetchProfiles(userIds);
    
    // Create lookup map for profiles
    const profilesMap = createMap(profilesData, 'id');
    
    // Process recommendations with profile data
    const processedRecs = recsData.map(rec => {
      const profile = profilesMap.get(rec.user_id);
      return {
        ...rec,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        likes: 0, // Will update this with a count query
        is_liked: false,
        is_saved: false
      };
    });
    
    // Get recommendation IDs for likes/saves queries
    const recIds = processedRecs.map(rec => rec.id);
    
    if (recIds.length > 0) {
      // Get likes count
      const { data: likesData } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id');
        
      // Count likes for each recommendation
      const likesCount = new Map();
      if (likesData) {
        likesData.forEach((like: any) => {
          const count = likesCount.get(like.recommendation_id) || 0;
          likesCount.set(like.recommendation_id, count + 1);
        });
      }
      
      // Get user likes
      const { data: userLikes } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id')
        .in('recommendation_id', recIds)
        .eq('user_id', userId);
        
      // Get saves  
      const { data: savesData } = await supabase
        .from('recommendation_saves')
        .select('recommendation_id')
        .in('recommendation_id', recIds)
        .eq('user_id', userId);
        
      // Update recommendations with like and save status
      processedRecs.forEach(rec => {
        rec.likes = likesCount.get(rec.id) || 0;
      });
      
      if (userLikes) {
        userLikes.forEach((like: any) => {
          const rec = processedRecs.find(r => r.id === like.recommendation_id);
          if (rec) rec.is_liked = true;
        });
      }
      
      if (savesData) {
        savesData.forEach((save: any) => {
          const rec = processedRecs.find(r => r.id === save.recommendation_id);
          if (rec) rec.is_saved = true;
        });
      }
    }
    
    return processedRecs;
  } catch (error) {
    console.error('Error processing recommendations:', error);
    throw error;
  }
};
