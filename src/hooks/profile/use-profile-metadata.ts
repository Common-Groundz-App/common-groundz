
import { useState } from 'react';

export const useProfileMetadata = () => {
  const [username, setUsername] = useState<string>('');
  const [bio, setBio] = useState<string>('Food Enthusiast');
  const [location, setLocation] = useState<string>('');
  const [memberSince, setMemberSince] = useState<string>('');

  const setProfileMetadata = (userMetadata: any, profileData: any) => {
    setLocation(profileData?.location || userMetadata?.location || '');
    
    if (profileData?.bio !== undefined && profileData?.bio !== null) {
      setBio(profileData.bio);
    }
    
    if (profileData?.created_at) {
      const createdDate = new Date(profileData.created_at);
      setMemberSince(createdDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long'
      }));
    } else {
      setMemberSince('Recently joined');
    }
  };

  const updateCounts = (followingData: number, followerData: number) => {
    // This function is implemented in the hook but needs to be added to the return object
    console.log('Updating counts:', followingData, followerData);
    // Implementation can be expanded if needed
  };

  return {
    username,
    setUsername,
    bio,
    setBio,
    location,
    setLocation,
    memberSince,
    setProfileMetadata,
    updateCounts
  };
};
