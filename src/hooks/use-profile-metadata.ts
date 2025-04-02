
import { useState, useEffect } from 'react';

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

  // Listen for immediate count updates from modal actions
  useEffect(() => {
    const handleFollowingCountChanged = (event: CustomEvent) => {
      if (event.detail) {
        if (event.detail.immediate && event.detail.countChange) {
          // Apply the change directly to current count
          setFollowingCount(prevCount => Math.max(0, prevCount + event.detail.countChange));
        } else if (typeof event.detail.count === 'number') {
          // Set to a specific value (existing behavior)
          setFollowingCount(event.detail.count);
        }
      }
    };

    const handleFollowerCountChanged = (event: CustomEvent) => {
      if (event.detail) {
        if (event.detail.immediate && event.detail.countChange) {
          // Apply the change directly to current count
          setFollowerCount(prevCount => Math.max(0, prevCount + event.detail.countChange));
        } else if (typeof event.detail.count === 'number') {
          // Set to a specific value (existing behavior)
          setFollowerCount(event.detail.count);
        }
      }
    };

    // Add event listeners
    window.addEventListener('profile-following-count-changed', handleFollowingCountChanged as EventListener);
    window.addEventListener('profile-follower-count-changed', handleFollowerCountChanged as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('profile-following-count-changed', handleFollowingCountChanged as EventListener);
      window.removeEventListener('profile-follower-count-changed', handleFollowerCountChanged as EventListener);
    };
  }, []);

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
