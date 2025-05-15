
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from '../recommendation/types';

export const fetchRecommendationById = async (id: string, userId?: string | null): Promise<Recommendation | null> => {
  try {
    // Query the recommendation by ID with entity and likes count
    const { data, error } = await supabase
      .from('recommendations')
      .select(`
        *,
        entity(*),
        recommendation_likes(count),
        profiles!recommendations_user_id_fkey(username, avatar_url)
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
    
    // Process the likes count
    const likes = data.recommendation_likes?.[0]?.count || 0;
    
    // Check if the current user has liked or saved this recommendation
    let isLiked = false;
    let isSaved = false;
    
    if (userId) {
      // Check if the user has liked this recommendation
      const { data: likeData, error: likeError } = await supabase
        .from('recommendation_likes')
        .select('id')
        .eq('recommendation_id', id)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (!likeError && likeData) {
        isLiked = true;
      }
      
      // Check if the user has saved this recommendation
      const { data: saveData, error: saveError } = await supabase
        .from('recommendation_saves')
        .select('id')
        .eq('recommendation_id', id)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (!saveError && saveData) {
        isSaved = true;
      }
    }
    
    // Extract profile information safely with proper type checking
    const profileData = data.profiles || {};
    // Use type assertion to tell TypeScript that profileData has these properties
    const username = typeof profileData === 'object' && profileData !== null && 'username' in profileData 
      ? (profileData as { username?: string }).username || null 
      : null;
    const avatar_url = typeof profileData === 'object' && profileData !== null && 'avatar_url' in profileData 
      ? (profileData as { avatar_url?: string }).avatar_url || null 
      : null;
    
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
