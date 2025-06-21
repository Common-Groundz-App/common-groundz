
import { SafeUserProfile } from '@/types/profile';

export const getFormattedDisplayName = (
  isOwnProfile: boolean,
  firstName: string,
  lastName: string,
  username: string,
  otherUserProfile?: SafeUserProfile | any
): string => {
  // For own profile, use first/last name if available
  if (isOwnProfile) {
    return firstName || lastName 
      ? `${firstName} ${lastName}`.trim() 
      : username;
  }
  
  // For other user's profile, use SafeUserProfile displayName consistently
  if (otherUserProfile?.displayName) {
    return otherUserProfile.displayName;
  }
  
  // Fallback to username with safe optional chaining
  return username || 'Anonymous User';
};

// Enhanced helper for consistent profile data handling
export const getConsistentProfileData = (profile: SafeUserProfile | null | undefined) => {
  if (!profile) {
    return {
      displayName: 'Anonymous User',
      username: 'Anonymous User',
      avatar_url: null,
      initials: 'AU'
    };
  }

  return {
    displayName: profile.displayName || 'Anonymous User',
    username: profile.username || 'Anonymous User', 
    avatar_url: profile.avatar_url,
    initials: profile.initials || 'AU'
  };
};
