
import React from 'react';
import { MapPin, Calendar, Users } from 'lucide-react';

interface ProfileInfoProps {
  location: string;
  memberSince: string;
  followingCount: number;
  followerCount: number;
}

const ProfileInfo = ({ location, memberSince, followingCount, followerCount }: ProfileInfoProps) => {
  return (
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
        <div className="flex items-center text-gray-600">
          <Users size={16} className="mr-1.5 text-gray-500" />
          <span>
            <span className="font-medium">{followingCount}</span> Following
          </span>
        </div>
        <div className="text-gray-600">
          <span className="font-medium">{followerCount}</span> Followers
        </div>
      </div>
    </div>
  );
};

export default ProfileInfo;
