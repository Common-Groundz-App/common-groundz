
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Award, Star, Users } from 'lucide-react';
import ProfileHeader from './ProfileHeader';
import { TabsContent } from '@/components/ui/tabs';
import ProfilePosts from './ProfilePosts';
import ProfileRecommendations from './ProfileRecommendations';
import ProfileReviews from './ProfileReviews';
import ProfileCircles from './ProfileCircles';
import { useProfileData } from '@/hooks/use-profile-data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCardStyles } from '@/utils/theme-utils';
import ProfileCard from './ProfileCard';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';

const ProfileContent = () => {
  const { userId } = useParams();
  const [activeTab, setActiveTab] = useState('posts');
  const cardStyles = useCardStyles();
  const { 
    isLoading, 
    error,
    coverImage,
    profileImage,
    username,
    bio,
    location,
    memberSince,
    followingCount,
    followerCount,
    hasChanges,
    isOwnProfile,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges,
    profileData
  } = useProfileData(userId);

  const tabs = [
    { title: "Posts", icon: FileText },
    { title: "Recs", icon: Award },
    { title: "Reviews", icon: Star },
    { title: "Circles", icon: Users }
  ];

  const handleTabChange = (index: number | null) => {
    if (index === null) return;
    const tabValue = tabs[index].title.toLowerCase();
    setActiveTab(tabValue);
  };

  useEffect(() => {
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
    <div className="pb-12">
      <ProfileHeader 
        coverImage={coverImage}
        isLoading={isLoading}
        onCoverImageChange={handleCoverImageChange}
        onCoverImageUpdated={handleCoverImageUpdated} 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-[300px] flex-shrink-0">
            <ProfileCard 
              username={username || ''}
              bio={bio || ''}
              location={location || ''}
              memberSince={memberSince || ''}
              followingCount={followingCount}
              followerCount={followerCount}
              profileImage={profileImage}
              isLoading={isLoading}
              onProfileImageChange={handleProfileImageChange}
              hasChanges={hasChanges}
              onSaveChanges={handleSaveChanges}
              isOwnProfile={isOwnProfile}
              profileUserId={profileData?.id}
            />
          </div>
          
          <div className="w-full md:flex-1 min-w-0">
            <ScrollArea className="w-full">
              <div className="mb-6">
                <ExpandableTabs 
                  tabs={tabs}
                  onChange={handleTabChange}
                  activeColor="text-brand-orange"
                  defaultSelected={0}
                  className="border-brand-orange/20 dark:border-brand-orange/10"
                />
              </div>

              {activeTab === 'posts' && (
                <ProfilePosts 
                  profileUserId={profileData?.id} 
                  isOwnProfile={isOwnProfile} 
                />
              )}
              
              {activeTab === 'recs' && (
                <ProfileRecommendations 
                  profileUserId={profileData?.id}
                  isOwnProfile={isOwnProfile}
                />
              )}
              
              {activeTab === 'reviews' && (
                <ProfileReviews 
                  profileUserId={profileData?.id} 
                  isOwnProfile={isOwnProfile}
                />
              )}
              
              {activeTab === 'circles' && (
                <ProfileCircles 
                  profileUserId={profileData?.id} 
                  isOwnProfile={isOwnProfile}
                />
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
