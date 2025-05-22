import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * Fetches a user's profile data from Supabase
 */
export const fetchUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in fetchUserProfile:', error);
    throw error;
  }
};

/**
 * Fetches a user's following count using RPC
 */
export const fetchFollowingCount = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_following_count_by_user_id', {
        user_id: userId
      });
      
    if (error) {
      console.error('Error fetching following count:', error);
      return 0;
    }
    
    return data || 0;
  } catch (error) {
    console.error('Error in fetchFollowingCount:', error);
    return 0;
  }
};

/**
 * Fetches a user's followers count using RPC
 */
export const fetchFollowerCount = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_follower_count_by_user_id', {
        user_id: userId
      });
      
    if (error) {
      console.error('Error fetching follower count:', error);
      return 0;
    }
    
    return data || 0;
  } catch (error) {
    console.error('Error in fetchFollowerCount:', error);
    return 0;
  }
};

/**
 * Updates a user's profile
 */
export const updateUserProfile = async (userId: string, updates: any) => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  
  if (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
  
  return true;
};

/**
 * Updates a user's preferences
 */
export const updateProfilePreferences = async (userId: string, preferences: Record<string, any>) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ preferences })
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateProfilePreferences:', error);
    throw error;
  }
};

/**
 * Gets the formatted display name from user data
 */
export const getDisplayName = (user: User | null, profileData: any): string => {
  if (!user) return '';
  
  const userMetadata = user.user_metadata;
  const firstName = userMetadata?.first_name || '';
  const lastName = userMetadata?.last_name || '';
  
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  } else if (profileData?.username) {
    return profileData.username;
  } else {
    return user.email?.split('@')[0] || 'User';
  }
};
