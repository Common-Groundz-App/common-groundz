
export const getFormattedDisplayName = (
  isOwnProfile: boolean,
  firstName: string,
  lastName: string,
  username: string,
  otherUserProfile: any
): string => {
  // For other user's profile, prioritize their profile data
  if (!isOwnProfile && otherUserProfile) {
    // First try to use username from the profile
    if (otherUserProfile.username) {
      return otherUserProfile.username;
    }
  }

  // For own profile
  if (isOwnProfile) {
    // Use first/last name if available
    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
    // Fall back to username
    return username;
  }

  // Final fallback to username
  return username || 'User';
};
