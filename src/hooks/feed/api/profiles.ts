import { supabase } from '@/integrations/supabase/client';

// This service is no longer needed since we're using the profile cache system
// Keeping minimal implementation for backward compatibility
export const fetchProfiles = async (userIds: string[]) => {
  if (!userIds.length) return { data: [], error: null };
  
  // This is now handled by the profile cache system
  // Return empty data to indicate we should use ProfileAvatar component instead
  return { data: [], error: null };
};
