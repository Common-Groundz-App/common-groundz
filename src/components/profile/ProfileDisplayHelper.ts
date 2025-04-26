
export const getFormattedDisplayName = (
  isOwnProfile: boolean,
  firstName: string,
  lastName: string,
  username: string,
  otherUserProfile: any
): string => {
  // For other user's profile, prioritize their profile data
  if (!isOwnProfile && otherUserProfile) {
    // Use full name from profile if available
    if (otherUserProfile.first_name || otherUserProfile.last_name) {
      return `${otherUserProfile.first_name || ''} ${otherUserProfile.last_name || ''}`.trim();
    }
    // Fallback to username from profile
    return otherUserProfile.username || username;
  }

  // For own profile, use first/last name if available
  if (isOwnProfile) {
    return firstName || lastName 
      ? `${firstName} ${lastName}`.trim() 
      : username;
  }
  
  return username;
};
