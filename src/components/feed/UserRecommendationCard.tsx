import React from 'react';
import { RecommendedUser } from '@/services/userRecommendationService';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import UsernameLink from '@/components/common/UsernameLink';
import { useFollow } from '@/hooks/use-follow';
import { Button } from '@/components/ui/button';

interface UserRecommendationCardProps {
  user: RecommendedUser;
}

export const UserRecommendationCard: React.FC<UserRecommendationCardProps> = ({ user }) => {
  const { isFollowing, followLoading, handleFollowToggle } = useFollow(user.id);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ProfileAvatar 
          userId={user.id} 
          size="sm"
          showSkeleton={false}
        />
        <div>
          <UsernameLink 
            username={user.displayName} 
            userId={user.id}
            className="font-medium text-sm"
          />
          <div className="text-xs text-muted-foreground">@{user.username}</div>
        </div>
      </div>
      <Button
        size="sm"
        variant={isFollowing ? "outline" : "default"}
        onClick={handleFollowToggle}
        disabled={followLoading}
        className="text-xs px-3 py-1 h-auto"
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </div>
  );
};