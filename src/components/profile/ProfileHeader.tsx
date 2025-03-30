
import React from 'react';
import ProfileCoverImage from './ProfileCoverImage';
import ProfileCard from './ProfileCard';

interface ProfileHeaderProps {
  coverImage: string;
  isLoading: boolean;
  onCoverImageChange: (url: string) => void;
  onCoverImageUpdated: (url: string | null) => void;
  username: string;
  bio: string;
  location: string;
  memberSince: string;
  followingCount: number;
  profileImage: string;
  onProfileImageChange: (url: string) => void;
  hasChanges: boolean;
  onSaveChanges: () => void;
  children?: React.ReactNode;
}

const ProfileHeader = ({
  coverImage,
  isLoading,
  onCoverImageChange,
  onCoverImageUpdated,
  username,
  bio,
  location,
  memberSince,
  followingCount,
  profileImage,
  onProfileImageChange,
  hasChanges,
  onSaveChanges,
  children
}: ProfileHeaderProps) => {
  return <>
      <ProfileCoverImage coverImage={coverImage} isLoading={isLoading} onCoverImageChange={onCoverImageChange} onCoverImageUpdated={onCoverImageUpdated} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Card - make it narrower */}
          <div className="md:w-[280px]">
            <ProfileCard 
              username={username} 
              bio={bio} 
              location={location} 
              memberSince={memberSince} 
              followingCount={followingCount} 
              profileImage={profileImage} 
              isLoading={isLoading} 
              onProfileImageChange={onProfileImageChange} 
              hasChanges={hasChanges} 
              onSaveChanges={onSaveChanges} 
            />
          </div>
          
          {/* Content Area - This div will now contain the tabs */}
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </>;
};

export default ProfileHeader;
