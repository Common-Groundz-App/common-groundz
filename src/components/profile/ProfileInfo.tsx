
import React, { useState } from 'react';
import { MapPin, Calendar, Users } from 'lucide-react';
import UserListModal from './modals/UserListModal';

interface ProfileInfoProps {
  location: string;
  memberSince: string;
  followingCount: number;
  followerCount: number;
  profileUserId?: string;
  isOwnProfile: boolean;
}

const ProfileInfo = ({ 
  location, 
  memberSince, 
  followingCount, 
  followerCount,
  profileUserId,
  isOwnProfile
}: ProfileInfoProps) => {
  const [showListModal, setShowListModal] = useState(false);
  const [activeListType, setActiveListType] = useState<'followers' | 'following'>('followers');

  const handleShowFollowers = () => {
    setActiveListType('followers');
    setShowListModal(true);
  };

  const handleShowFollowing = () => {
    setActiveListType('following');
    setShowListModal(true);
  };

  return (
    <>
      <div className="w-full space-y-3 mt-2">
        {location && (
          <div className="flex items-center text-sm text-gray-600">
            <MapPin size={16} className="mr-1.5 text-gray-500" />
            <span>{location}</span>
          </div>
        )}
        
        <div className="flex items-center text-sm text-gray-600">
          <Calendar size={16} className="mr-1.5 text-gray-500" />
          <span>Joined {memberSince}</span>
        </div>
        
        <div className="flex items-center gap-3 text-sm">
          <div 
            className="flex items-center text-gray-600 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={handleShowFollowing}
          >
            <Users size={16} className="mr-1.5 text-gray-500" />
            <span>
              <span className="font-medium">{followingCount}</span> Following
            </span>
          </div>
          <div 
            className="text-gray-600 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={handleShowFollowers}
          >
            <span className="font-medium">{followerCount}</span> Followers
          </div>
        </div>
      </div>

      {profileUserId && (
        <UserListModal 
          open={showListModal}
          onOpenChange={setShowListModal}
          profileUserId={profileUserId}
          listType={activeListType}
          isOwnProfile={isOwnProfile}
        />
      )}
    </>
  );
};

export default ProfileInfo;
