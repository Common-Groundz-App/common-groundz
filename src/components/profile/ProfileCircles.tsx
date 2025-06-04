import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Filter, ChevronDown } from 'lucide-react';
import FollowersList from './circles/FollowersList';
import FollowingList from './circles/FollowingList';
import { useCircleData } from './circles/useCircleData';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        <h2 className="text-lg sm:text-lg lg:text-xl font-semibold">
          {isOwnProfile ? 'My Circles' : 'Circles'}
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Filter Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Filter size={14} />
                <span className="max-[500px]:hidden">Filter</span>
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuItem className="text-sm font-medium text-gray-500 py-1.5" disabled>
                  Sort By
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  Recent
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  Alphabetical
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  Most Active
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
