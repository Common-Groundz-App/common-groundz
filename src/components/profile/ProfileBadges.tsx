
import React from 'react';

interface ProfileBadgesProps {
  isOwnProfile: boolean;
  hasVerifiedEmail?: boolean;
}

const ProfileBadges = ({ isOwnProfile, hasVerifiedEmail = false }: ProfileBadgesProps) => {
  // This component can be extended later to show badges like verified, premium, etc.
  return (
    <div className="flex space-x-1 mt-1">
      {/* Future badges can be added here */}
    </div>
  );
};

export default ProfileBadges;
