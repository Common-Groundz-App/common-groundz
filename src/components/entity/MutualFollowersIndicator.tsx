
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SafeUserProfile } from '@/types/profile';

interface MutualFollowersIndicatorProps {
  mutualFollowers: SafeUserProfile[];
  count: number;
  isLoading?: boolean;
}

export const MutualFollowersIndicator: React.FC<MutualFollowersIndicatorProps> = ({
  mutualFollowers,
  count,
  isLoading = false
}) => {
  // Debug logging to track component rendering
  console.log('🔍 [MutualFollowersIndicator] Rendering with:', { 
    count, 
    isLoading, 
    mutualFollowersLength: mutualFollowers.length,
    mutualFollowers: mutualFollowers.map(f => ({ id: f.id, displayName: f.displayName }))
  });

  if (isLoading) {
    console.log('⏳ [MutualFollowersIndicator] Showing loading state');
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="animate-pulse">Loading mutual followers...</div>
      </div>
    );
  }

  if (count === 0) {
    console.log('❌ [MutualFollowersIndicator] No mutual followers, hiding component');
    return null;
  }

  console.log('✅ [MutualFollowersIndicator] Showing mutual followers component');

  const displayCount = Math.min(3, mutualFollowers.length);
  const remainingCount = count - displayCount;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex -space-x-1">
        {mutualFollowers.slice(0, displayCount).map((follower) => (
          <Avatar key={follower.id} className="h-6 w-6 border-2 border-background">
            <AvatarImage src={follower.avatar_url || undefined} alt={follower.displayName} />
            <AvatarFallback className="text-xs">
              {follower.initials}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span>
        {count === 1 
          ? '1 friend also follows this'
          : remainingCount > 0 
            ? `${displayCount}+ friends also follow this`
            : `${count} friends also follow this`
        }
      </span>
    </div>
  );
};
