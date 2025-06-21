
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from '../recommendation/types';
import { fetchSingleProfile } from '../unifiedProfileService';

export const fetchRecommendationById = async (id: string, userId?: string | null): Promise<Recommendation | null> => {
  try {
    // Use a single query to get recommendation and entity data
    const { data, error } = await supabase
      .from('recommendations')
      .select(`
        *,
        entity:entities(*)
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
    
    // Fetch profile using unified service
    const profile = await fetchSingleProfile(data.user_id);
    
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
    
    // Return the processed recommendation with unified profile data
    const processedData = {
      ...data,
      likes,
      isLiked,
      isSaved,
      // Legacy properties for backward compatibility
      username: profile.displayName,
      avatar_url: profile.avatar_url
    };
    
    // Type cast to ensure compatibility
    return processedData as unknown as Recommendation;
    
  } catch (error) {
    console.error('Error in fetchRecommendationById:', error);
    return null;
  }
};
