
import { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getDisplayName } from '@/services/profileService';

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

  return {
    username,
    setUsername,
    bio,
    location,
    memberSince,
    setProfileMetadata
  };
};
