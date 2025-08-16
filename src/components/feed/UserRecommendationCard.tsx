import React, { useState } from 'react';
import { RecommendedUser, logUserImpression } from '@/services/userRecommendationService';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import UsernameLink from '@/components/common/UsernameLink';
import { useFollow } from '@/hooks/use-follow';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface UserRecommendationCardProps {
  user: RecommendedUser;
  onFollowSuccess?: () => void;
}

export const UserRecommendationCard: React.FC<UserRecommendationCardProps> = ({ 
  user, 
  onFollowSuccess 
}) => {
  const { user: currentUser } = useAuth();
  const { isFollowing, followLoading, handleFollowToggle } = useFollow(user.id);
  const [isHidden, setIsHidden] = useState(false);

  const handleOptimisticFollow = async () => {
    // Optimistic UI - hide the card immediately
    setIsHidden(true);
    
    try {
      await handleFollowToggle();
      
      // Log impression only after successful follow
      if (currentUser?.id) {
        await logUserImpression(currentUser.id, user.id);
      }
      
      onFollowSuccess?.();
    } catch (error) {
      // Restore the card if follow failed
      setIsHidden(false);
    }
  };

  // Hide the card if user followed successfully
  if (isHidden || isFollowing) {
    return null;
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ProfileAvatar 
          userId={user.id} 
          size="sm"
          showSkeleton={false}
        />
        <div className="flex-1 min-w-0">
          <UsernameLink 
            username={user.displayName} 
            userId={user.id}
            className="font-medium text-sm block truncate"
          />
          <div className="text-xs text-muted-foreground truncate">
            @{user.username}
          </div>
          {user.reason && (
            <div className="text-xs text-muted-foreground/80 truncate mt-0.5">
              {user.reason}
            </div>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="default"
        onClick={handleOptimisticFollow}
        disabled={followLoading}
        className="text-xs px-3 py-1 h-auto ml-2 shrink-0"
      >
        {followLoading ? 'Following...' : 'Follow'}
      </Button>
    </div>
  );
};