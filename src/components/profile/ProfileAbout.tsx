
import React from 'react';

interface ProfileAboutProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfileAbout = ({ profileUserId, isOwnProfile }: ProfileAboutProps) => {
  return (
    <div className="p-4 text-center text-gray-500">
      About content will go here
    </div>
  );
};

export default ProfileAbout;
