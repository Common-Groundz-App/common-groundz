
import { supabase } from '@/integrations/supabase/client';

// Fetch user profiles by user IDs
export const fetchProfiles = async (userIds: string[]) => {
  if (!userIds.length) return { data: [], error: null };
  
  return await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);
};
