
export const getFormattedDisplayName = (
  isOwnProfile: boolean,
  firstName: string,
  lastName: string,
  username: string,
  otherUserProfile: any
): string => {
  // For own profile, use first/last name if available
  if (isOwnProfile) {
    return firstName || lastName 
      ? `${firstName} ${lastName}`.trim() 
      : username;
  }
  // For other user's profile, prioritize their username from the database
  else if (otherUserProfile) {
    return otherUserProfile.username || username;
  }
  
  return username;
};
