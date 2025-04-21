
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProfileData } from '@/hooks/use-profile-data';
import ProfileHeader from './ProfileHeader';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import ProfileCard from './ProfileCard';
import ProfileTabs from './ProfileTabs';

// Content components
import ProfilePosts from './ProfilePosts';
import ProfileRecommendations from './ProfileRecommendations';
import ProfileReviews from './ProfileReviews';
import ProfileCircles from './ProfileCircles';

// Loading and error states
import ProfileLoadingState from './states/ProfileLoadingState';
import ProfileErrorState from './states/ProfileErrorState';

const ProfileContent = () => {
  const { userId } = useParams();
  const [activeTab, setActiveTab] = useState('posts');
  
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

  useEffect(() => {
    setActiveTab('posts');
  }, [userId]);

  if (isLoading) {
    return <ProfileLoadingState />;
  }

  if (error || !profileData) {
    return <ProfileErrorState error={error} />;
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
              <TubelightTabs 
                defaultValue={activeTab} 
                onValueChange={setActiveTab}
                items={ProfileTabs}
                className="mb-6"
              >
                <TabsContent value="posts">
                  <ProfilePosts 
                    profileUserId={profileData?.id} 
                    isOwnProfile={isOwnProfile} 
                  />
                </TabsContent>
                
                <TabsContent value="recommendations">
                  <ProfileRecommendations 
                    profileUserId={profileData?.id}
                    isOwnProfile={isOwnProfile}
                  />
                </TabsContent>
                
                <TabsContent value="reviews">
                  <ProfileReviews 
                    profileUserId={profileData?.id} 
                    isOwnProfile={isOwnProfile}
                  />
                </TabsContent>
                
                <TabsContent value="circles">
                  <ProfileCircles 
                    profileUserId={profileData?.id} 
                    isOwnProfile={isOwnProfile}
                  />
                </TabsContent>
              </TubelightTabs>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
