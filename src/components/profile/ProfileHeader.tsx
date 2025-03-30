
import React from 'react';
import ProfileCoverImage from './ProfileCoverImage';
import ProfileCard from './ProfileCard';

interface ProfileHeaderProps {
  coverImage: string;
  isLoading: boolean;
  onCoverImageChange?: (url: string) => void;
  onCoverImageUpdated?: (url: string | null) => void;
  username: string;
  bio: string;
  location: string;
  memberSince: string;
  followingCount: number;
  profileImage: string;
  onProfileImageChange?: (url: string) => void;
  hasChanges: boolean;
  onSaveChanges?: () => void;
  isOwnProfile: boolean;
  profileUserId?: string;
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
  isOwnProfile,
  profileUserId
}: ProfileHeaderProps) => {
  return (
    <>
      <ProfileCoverImage 
        coverImage={coverImage} 
        isLoading={isLoading} 
        onCoverImageChange={onCoverImageChange} 
        onCoverImageUpdated={onCoverImageUpdated}
        isEditable={isOwnProfile} 
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Profile Card - center on mobile, fixed width on desktop */}
          <div className="w-full flex justify-center md:justify-start md:w-[300px] flex-shrink-0">
            <div className="w-full max-w-[300px] md:w-full">
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
                isOwnProfile={isOwnProfile}
                profileUserId={profileUserId}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileHeader;
