
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FollowersList from './circles/FollowersList';
import FollowingList from './circles/FollowingList';
import { useCircleData } from './circles/useCircleData';

interface ProfileCirclesProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfileCircles = ({ profileUserId, isOwnProfile }: ProfileCirclesProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('followers');
  
  const {
    followers,
    following,
    isLoading,
    actionLoading,
    handleFollowToggle
  } = useCircleData(profileUserId, user?.id);

  const handleNavigateToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded"></div>
        </div>
        
        {/* Tabs Skeleton */}
        <div className="w-full h-10 bg-gray-100 dark:bg-gray-800 animate-pulse rounded"></div>
        
        {/* Content Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 animate-pulse rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {isOwnProfile ? 'My Circles' : 'Circles'}
        </h2>
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="followers" onValueChange={(value) => setActiveTab(value as 'followers' | 'following')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="followers">Followers</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
        </TabsList>
        
        <TabsContent value="followers" className="space-y-4">
          <FollowersList 
            followers={followers}
            isLoading={isLoading}
            onFollowToggle={handleFollowToggle}
            actionLoading={actionLoading}
            isOwnProfile={isOwnProfile}
            currentUserId={user?.id}
            onNavigate={handleNavigateToProfile}
          />
        </TabsContent>
        
        <TabsContent value="following" className="space-y-4">
          <FollowingList 
            following={following}
            isLoading={isLoading}
            onFollowToggle={handleFollowToggle}
            actionLoading={actionLoading}
            isOwnProfile={isOwnProfile}
            currentUserId={user?.id}
            onNavigate={handleNavigateToProfile}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileCircles;
