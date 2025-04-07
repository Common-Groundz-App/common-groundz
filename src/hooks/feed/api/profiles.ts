
import { supabase } from '@/integrations/supabase/client';

// Fetch profiles by user IDs
export const fetchProfiles = async (userIds: string[]) => {
  if (!userIds || userIds.length === 0) {
    return { data: [], error: null };
  }
  
  return await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);
};
