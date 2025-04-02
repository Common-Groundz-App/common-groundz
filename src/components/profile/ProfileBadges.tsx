
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from 'lucide-react';

interface ProfileBadgesProps {
  isOwnProfile: boolean;
  hasVerifiedEmail?: boolean;
}

const ProfileBadges = ({ isOwnProfile, hasVerifiedEmail = false }: ProfileBadgesProps) => {
  return (
    <div className="flex space-x-1 mt-1">
      {hasVerifiedEmail && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center">
          <CheckCircle2 size={12} className="mr-1" /> Verified
        </Badge>
      )}
    </div>
  );
};

export default ProfileBadges;
