
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Users, Award } from 'lucide-react';

interface ProfileBadgesProps {
  isOwnProfile: boolean;
  hasVerifiedEmail?: boolean;
  followerCount?: number;
  isProMember?: boolean;
}

const ProfileBadges = ({ 
  isOwnProfile, 
  hasVerifiedEmail = false, 
  followerCount = 0,
  isProMember = false
}: ProfileBadgesProps) => {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {hasVerifiedEmail && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center">
          <CheckCircle2 size={12} className="mr-1" /> Verified
        </Badge>
      )}
      
      {followerCount > 0 && (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center">
          <Users size={12} className="mr-1" /> {followerCount} {followerCount === 1 ? 'Follower' : 'Followers'}
        </Badge>
      )}
      
      {isProMember && (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 flex items-center">
          <Award size={12} className="mr-1" /> Pro Member
        </Badge>
      )}
    </div>
  );
};

export default ProfileBadges;
