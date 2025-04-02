
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

  return (
    <div className="space-y-6">
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
