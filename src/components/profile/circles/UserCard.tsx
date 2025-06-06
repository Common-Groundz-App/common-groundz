
import React from 'react';
import { Button } from '@/components/ui/button';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import UsernameLink from '@/components/common/UsernameLink';

interface UserCardProps {
  id: string;
  username: string;
  isFollowing: boolean;
  relationshipType: 'follower' | 'following';
  onFollowToggle: () => void;
  isLoading: boolean;
  isOwnProfile: boolean;
  currentUserId?: string;
  onNavigate?: () => void;
}

const UserCard = ({ 
  id, 
  username, 
  isFollowing, 
  relationshipType, 
  onFollowToggle, 
  isLoading,
  isOwnProfile,
  currentUserId,
  onNavigate
}: UserCardProps) => {
  const isCurrentUser = currentUserId === id;
  const showFollowButton = !isOwnProfile && !isCurrentUser;

  const handleCardClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={handleCardClick}
    >
      <div className="flex items-center space-x-3">
        <ProfileAvatar userId={id} size="md" className="border" />
        <div>
          <UsernameLink 
            userId={id}
            username={username}
            className="font-medium hover:underline"
          />
        </div>
      </div>
      
      {showFollowButton && (
        <Button
          variant={isFollowing ? "outline" : "default"}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onFollowToggle();
          }}
          disabled={isLoading}
        >
          {isLoading ? "..." : (isFollowing ? "Unfollow" : "Follow")}
        </Button>
      )}
    </div>
  );
};

export default UserCard;
