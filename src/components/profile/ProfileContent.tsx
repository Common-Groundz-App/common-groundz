
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProfileHeader from './ProfileHeader';
import ProfileTabs from './ProfileTabs';
import { useProfileData } from '@/hooks/use-profile-data';

const ProfileContent = () => {
  const { userId } = useParams();
  const [activeTab, setActiveTab] = useState('posts');
  const { profileData, isLoading, error, isOwnProfile } = useProfileData(userId);

  useEffect(() => {
    // Reset to first tab when changing profiles
    setActiveTab('posts');
  }, [userId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md mb-6"></div>
        <div className="w-1/3 h-8 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md mx-auto mb-8"></div>
        <div className="w-full h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md"></div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-bold text-red-500 mb-2">Error Loading Profile</h2>
        <p className="text-muted-foreground">
          {error?.message || 'Unable to load profile data. The user may not exist.'}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto pb-12">
      <ProfileHeader 
        profile={profileData} 
        isOwnProfile={isOwnProfile} 
      />

      <ProfileTabs 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        isOwnProfile={isOwnProfile}
        profileUserId={profileData.id}
        username={profileData.username}
      />
    </div>
  );
};

export default ProfileContent;
