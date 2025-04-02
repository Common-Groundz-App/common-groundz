
import React from 'react';
import UserCard from './UserCard';
import UserCardSkeleton from './UserCardSkeleton';
import EmptyState from './EmptyState';
import { UserProfile } from './types';
import { Separator } from '@/components/ui/separator';

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
            avatarUrl={follow.avatar_url}
            isFollowing={follow.isFollowing}
            relationshipType="following"
            onFollowToggle={onFollowToggle}
            isLoading={actionLoading === follow.id}
            isOwnProfile={isOwnProfile}
            currentUserId={currentUserId}
            onNavigate={onNavigate}
          />
        </div>
      ))}
    </div>
  );
};

export default FollowingList;
