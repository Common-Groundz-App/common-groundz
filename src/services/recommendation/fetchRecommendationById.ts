
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from '../recommendation/types';

export const fetchRecommendationById = async (id: string, userId?: string | null): Promise<Recommendation | null> => {
  try {
    // Use a single query with JOINs to get all data at once
    const { data, error } = await supabase
      .from('recommendations')
      .select(`
        *,
        entity:entities(*),
        profiles:profiles!recommendations_user_id_fkey(username, avatar_url)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching recommendation:', error);
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    // Batch fetch user interaction data and like counts
    let isLiked = false;
    let isSaved = false;
    let likes = 0;
    
    if (userId) {
      const [likeData, saveData, likeCountData] = await Promise.all([
        // Check if the user has liked this recommendation
        supabase
          .from('recommendation_likes')
          .select('id')
          .eq('recommendation_id', id)
          .eq('user_id', userId)
          .maybeSingle(),
        
        // Check if the user has saved this recommendation
        supabase
          .from('recommendation_saves')
          .select('id')
          .eq('recommendation_id', id)
          .eq('user_id', userId)
          .maybeSingle(),
        
        // Get like count using RPC function
        supabase.rpc('get_recommendation_likes_by_ids', {
          p_recommendation_ids: [id]
        })
      ]);
      
      isLiked = !!likeData.data;
      isSaved = !!saveData.data;
      likes = likeCountData.data?.[0]?.like_count || 0;
    } else {
      // If no user, just get like count
      const { data: likeCountData } = await supabase.rpc('get_recommendation_likes_by_ids', {
        p_recommendation_ids: [id]
      });
      
      likes = likeCountData?.[0]?.like_count || 0;
    }
    
    // Extract profile information safely
    const profileData = data.profiles || {};
    const username = profileData.username || null;
    const avatar_url = profileData.avatar_url || null;
    
    // Return the processed recommendation with added data
    const processedData = {
      ...data,
      likes,
      isLiked,
      isSaved,
      username,
      avatar_url
    };
    
    delete processedData.profiles;  // Clean up the nested profiles data
    
    // Type cast to ensure compatibility
    return processedData as unknown as Recommendation;
    
  } catch (error) {
    console.error('Error in fetchRecommendationById:', error);
    return null;
  }
};
