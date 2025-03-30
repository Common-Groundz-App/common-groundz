
import React from 'react';
import UserCard from './UserCard';
import UserCardSkeleton from './UserCardSkeleton';
import EmptyState from './EmptyState';
import { UserProfile } from './types';

interface FollowersListProps {
  followers: UserProfile[];
  isLoading: boolean;
  onFollowToggle: (userId: string, isFollowing: boolean) => void;
  actionLoading: string | null;
  isOwnProfile: boolean;
  currentUserId?: string;
}

const FollowersList = ({ 
  followers, 
  isLoading, 
  onFollowToggle, 
  actionLoading,
  isOwnProfile,
  currentUserId
}: FollowersListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <UserCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (followers.length === 0) {
    return <EmptyState type="followers" />;
  }

  return (
    <div className="space-y-4">
      {followers.map(follower => (
        <UserCard
          key={follower.id}
          id={follower.id}
          username={follower.username}
          avatarUrl={follower.avatar_url}
          isFollowing={follower.isFollowing}
          relationshipType="follower"
          onFollowToggle={onFollowToggle}
          isLoading={actionLoading === follower.id}
          isOwnProfile={isOwnProfile}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
};

export default FollowersList;
