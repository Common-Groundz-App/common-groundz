import { supabase } from '@/integrations/supabase/client';
import { SafeUserProfile } from '@/types/profile';

export async function searchProfiles(searchTerm: string): Promise<SafeUserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', `%${searchTerm}%`)
    .limit(10);

  if (error) {
    console.error('Error searching profiles:', error);
    return [];
  }

  return data?.map(profile => ({
    id: profile.id,
    username: profile.username || 'Anonymous',
    avatar_url: profile.avatar_url,
    displayName: profile.username || 'Anonymous',
    initials: profile.username?.[0]?.toUpperCase() || 'A',
    fullName: profile.first_name && profile.last_name 
      ? `${profile.first_name} ${profile.last_name}` 
      : null,
    first_name: profile.first_name,
    last_name: profile.last_name,
    bio: profile.bio,
    location: profile.location,
  })) || [];
}

export async function fetchUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

// Add missing functions that are imported elsewhere
export async function getDisplayName(userId: string): Promise<string> {
  const profile = await fetchUserProfile(userId);
  return profile?.username || 'Anonymous User';
}

export async function updateUserPreferences(userId: string, preferences: any) {
  const { data, error } = await supabase
    .from('profiles')
    .update(preferences)
    .eq('id', userId);
  
  if (error) throw error;
  return data;
}

export async function fetchFollowerCount(userId: string): Promise<number> {
  // Placeholder implementation
  return 0;
}

export async function fetchFollowingCount(userId: string): Promise<number> {
  // Placeholder implementation
  return 0;
}

export async function updateUserProfile(userId: string, updates: any) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  
  if (error) throw error;
  return data;
}