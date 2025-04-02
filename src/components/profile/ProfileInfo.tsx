
import React from 'react';
import { MapPin, Calendar, Users } from 'lucide-react';

interface ProfileInfoProps {
  location: string;
  memberSince: string;
  followingCount: number;
  followerCount?: number;
}

const ProfileInfo = ({ location, memberSince, followingCount, followerCount = 0 }: ProfileInfoProps) => {
  return (
    <div className="w-full space-y-3 text-left">
      <div className="flex items-center text-gray-700">
        <MapPin className="w-5 h-5 mr-2" />
        <span>{location}</span>
      </div>
      
      <div className="flex items-center text-gray-700">
        <Calendar className="w-5 h-5 mr-2" />
        <span>Member since {memberSince}</span>
      </div>
      
      <div className="flex items-center text-gray-700">
        <Users className="w-5 h-5 mr-2" />
        <span>{followingCount} following</span>
      </div>
      
      <div className="flex items-center text-gray-700">
        <Users className="w-5 h-5 mr-2" />
        <span>{followerCount} followers</span>
      </div>
    </div>
  );
};

export default ProfileInfo;
