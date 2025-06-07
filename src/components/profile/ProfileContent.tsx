import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Newspaper, Crown, Star, UsersRound } from 'lucide-react';
import ProfileHeader from './ProfileHeader';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import ProfilePosts from './ProfilePosts';
import ProfileRecommendations from './ProfileRecommendations';
import ProfileReviews from './ProfileReviews';
import ProfileCircles from './ProfileCircles';
import { useProfileData } from '@/hooks/use-profile-data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCardStyles } from '@/utils/theme-utils';
import ProfileCard from './ProfileCard';
import { useAuth } from '@/contexts/AuthContext';
import { SmartComposerButton } from '@/components/feed/SmartComposerButton';

interface ProfileContentProps {
  profileUserId?: string;
  defaultActiveTab?: string;
}

const ProfileContent = React.memo(({ profileUserId, defaultActiveTab = 'posts' }: ProfileContentProps) => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || defaultActiveTab;
  const cardStyles = useCardStyles();
  
  // Use profileUserId prop if provided, otherwise use id from params
  const userId = profileUserId || id;
  
  const { 
    isLoading, 
    error,
    coverImage,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges,
    isOwnProfile
  } = useProfileData(userId);

  // Handle tab change by updating URL parameter instead of state
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Memoize the profile user ID to prevent unnecessary rerenders
  const profileUserIdToUse = useMemo(() => userId || user?.id, [userId, user?.id]);
  
  // Memoize tab items to prevent unnecessary rerenders - NOW WITH UPDATED ICONS
  const tabItems = useMemo(() => [
    { value: 'posts', label: 'Posts', icon: Newspaper },
    { value: 'recommendations', label: 'Recs', icon: Crown },
    { value: 'reviews', label: 'Reviews', icon: Star },
    { value: 'circles', label: 'Circles', icon: UsersRound }
  ], []);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md mb-6"></div>
        <div className="w-1/3 h-8 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md mx-auto mb-8"></div>
        <div className="w-full h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md"></div>
      </div>
    );
  }

  if (error) {
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
      {/* Hidden SmartComposerButton to handle create post events */}
      <div className="hidden">
        <SmartComposerButton onContentCreated={() => {
          // Refresh profile posts when content is created
          window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
        }} />
      </div>

      <ProfileHeader 
        coverImage={coverImage}
        isLoading={isLoading}
        onCoverImageChange={handleCoverImageChange}
        onCoverImageUpdated={handleCoverImageUpdated} 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-[300px] flex-shrink-0">
            <ProfileCard profileUserId={profileUserIdToUse} />
          </div>
          
          <div className="w-full md:flex-1 min-w-0">
            <ScrollArea className="w-full">
              <TubelightTabs 
                defaultValue={activeTab} 
                onValueChange={handleTabChange}
                items={tabItems}
                className="mb-6"
              >
                <TabsContent value="posts">
                  <ProfilePosts 
                    profileUserId={profileUserIdToUse} 
                    isOwnProfile={isOwnProfile} 
                  />
                </TabsContent>
                
                <TabsContent value="recommendations">
                  <ProfileRecommendations 
                    profileUserId={profileUserIdToUse}
                    isOwnProfile={isOwnProfile}
                  />
                </TabsContent>
                
                <TabsContent value="reviews">
                  <ProfileReviews 
                    profileUserId={profileUserIdToUse} 
                    isOwnProfile={isOwnProfile}
                  />
                </TabsContent>
                
                <TabsContent value="circles">
                  <ProfileCircles 
                    profileUserId={profileUserIdToUse} 
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
});

ProfileContent.displayName = 'ProfileContent';

export default ProfileContent;
