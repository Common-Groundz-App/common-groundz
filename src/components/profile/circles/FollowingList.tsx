
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
  onNavigate?: (userId: string) => void;
}

const FollowingList = ({ 
  following, 
  isLoading, 
  onFollowToggle, 
  actionLoading,
  isOwnProfile,
  currentUserId,
  onNavigate
}: FollowingListProps) => {
  console.log('FollowingList Debug:', { 
    followingCount: following.length, 
    following: following.map(f => ({ id: f.id, username: f.username, isFollowing: f.isFollowing })),
    currentUserId,
    isOwnProfile 
  });

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
    <div className="divide-y divide-gray-100">
      {following.map(follow => (
        <div key={follow.id} className="transition-all duration-200 hover:bg-gray-50">
          <UserCard
            id={follow.id}
            username={follow.username}
            isFollowing={follow.isFollowing}
            relationshipType="following"
            onFollowToggle={() => onFollowToggle(follow.id, follow.isFollowing)}
            isLoading={actionLoading === follow.id}
            isOwnProfile={isOwnProfile}
            currentUserId={currentUserId}
            onNavigate={onNavigate ? () => onNavigate(follow.id) : undefined}
          />
        </div>
      ))}
    </div>
  );
};

export default FollowingList;
