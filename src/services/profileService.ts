
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * Fetches a user's profile data from Supabase
 */
export const fetchUserProfile = async (userId: string) => {
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
};

/**
 * Fetches a user's following count
 */
export const fetchFollowingCount = async (userId: string) => {
  const { data, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact' })
    .eq('follower_id', userId);
    
  if (error) {
    console.error('Error fetching following count:', error);
    throw error;
  }
  
  return data?.length || 0;
};

/**
 * Fetches a user's followers count
 */
export const fetchFollowerCount = async (userId: string) => {
  const { data, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact' })
    .eq('following_id', userId);
    
  if (error) {
    console.error('Error fetching follower count:', error);
    throw error;
  }
  
  return data?.length || 0;
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
