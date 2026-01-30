import { supabase } from '@/integrations/supabase/client';

interface UsernameResolution {
  userId: string;
  currentUsername: string | null;
  wasRedirected: boolean;
  notFound: boolean;
}

export const resolveUsername = async (
  username: string
): Promise<UsernameResolution> => {
  const normalizedUsername = username.toLowerCase();
  
  // First: Check current profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', normalizedUsername)
    .maybeSingle();
  
  if (profile) {
    return {
      userId: profile.id,
      currentUsername: profile.username,
      wasRedirected: false,
      notFound: false
    };
  }
  
  // Second: Check username history
  const { data: history } = await supabase
    .from('username_history')
    .select('user_id')
    .eq('old_username', normalizedUsername)
    .maybeSingle();
  
  if (history) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', history.user_id)
      .single();
    
    if (!currentProfile?.username) {
      return {
        userId: history.user_id,
        currentUsername: null,
        wasRedirected: true,
        notFound: false
      };
    }
    
    return {
      userId: history.user_id,
      currentUsername: currentProfile.username,
      wasRedirected: true,
      notFound: false
    };
  }
  
  return {
    userId: '',
    currentUsername: null,
    wasRedirected: false,
    notFound: true
  };
};
