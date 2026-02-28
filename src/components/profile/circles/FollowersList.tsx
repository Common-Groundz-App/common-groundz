
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
  onNavigate?: (userId: string, username?: string) => void;
}

const FollowersList = ({ 
  followers, 
  isLoading, 
  onFollowToggle, 
  actionLoading,
  isOwnProfile,
  currentUserId,
  onNavigate
}: FollowersListProps) => {
  console.log('FollowersList Debug:', { 
    followersCount: followers.length, 
    followers: followers.map(f => ({ id: f.id, username: f.username, isFollowing: f.isFollowing })),
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

  if (followers.length === 0) {
    return <EmptyState type="followers" />;
  }

  return (
    <div className="divide-y divide-gray-100">
      {followers.map(follower => (
        <div key={follower.id} className="transition-all duration-200 hover:bg-gray-50">
          <UserCard
            id={follower.id}
            username={follower.username}
            avatarUrl={follower.avatar_url}
            isFollowing={follower.isFollowing}
            relationshipType="follower"
            onFollowToggle={() => onFollowToggle(follower.id, follower.isFollowing)}
            isLoading={actionLoading === follower.id}
            isOwnProfile={isOwnProfile}
            currentUserId={currentUserId}
            onNavigate={onNavigate ? () => onNavigate(follower.id, follower.username ?? undefined) : undefined}
          />
        </div>
      ))}
    </div>
  );
};

export default FollowersList;
