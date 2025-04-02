
import { useState } from 'react';

export const useProfileMetadata = () => {
  const [username, setUsername] = useState<string>('');
  const [bio, setBio] = useState<string>('Food Enthusiast');
  const [location, setLocation] = useState<string>('');
  const [memberSince, setMemberSince] = useState<string>('');
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [followerCount, setFollowerCount] = useState<number>(0);

  // Set profile metadata from user and profile data
  const setProfileMetadata = (userMetadata: any, profileData: any) => {
    // Set location from profile data or metadata or use default
    setLocation(profileData?.location || userMetadata?.location || '');
    
    // Set bio if available
    if (profileData?.bio !== undefined && profileData?.bio !== null) {
      setBio(profileData.bio);
    }
    
    // Format the created_at date for member since
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

  // Update counts
  const updateCounts = (followingData: number, followerData: number) => {
    setFollowingCount(followingData);
    setFollowerCount(followerData);
  };

  return {
    username,
    setUsername,
    bio,
    setBio,
    location,
    setLocation,
    memberSince,
    followingCount,
    setFollowingCount,
    followerCount,
    setFollowerCount,
    setProfileMetadata,
    updateCounts
  };
};
