
import { User } from '@supabase/supabase-js';

export const getFormattedDisplayName = (
  isOwnProfile: boolean, 
  firstName: string, 
  lastName: string, 
  username: string,
  otherUserProfile: any
): string => {
  if (!isOwnProfile && otherUserProfile) {
    return otherUserProfile.username || 'User';
  }
  
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  } else if (username) {
    return username;
  } else {
    return 'User';
  }
};
