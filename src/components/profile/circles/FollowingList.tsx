
import React from 'react';
import UserCard from './UserCard';
import UserCardSkeleton from './UserCardSkeleton';
import EmptyState from './EmptyState';
import { UserProfile } from './types';

interface FollowingListProps {
  following: UserProfile[];
  isLoading: boolean;
  onFollowToggle: (userId: string, isFollowing: boolean) => void;
  actionLoading: string | null;
  isOwnProfile: boolean;
  currentUserId?: string;
}

const FollowingList = ({ 
  following, 
  isLoading, 
  onFollowToggle, 
  actionLoading,
  isOwnProfile,
  currentUserId
}: FollowingListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <UserCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (following.length === 0) {
    return <EmptyState type="following" />;
  }

  return (
    <div className="space-y-4">
      {following.map(follow => (
        <UserCard
          key={follow.id}
          id={follow.id}
          username={follow.username}
          avatarUrl={follow.avatar_url}
          isFollowing={follow.isFollowing}
          relationshipType="following"
          onFollowToggle={onFollowToggle}
          isLoading={actionLoading === follow.id}
          isOwnProfile={isOwnProfile}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
};

export default FollowingList;
