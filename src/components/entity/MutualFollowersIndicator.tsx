import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMutualEntityFollowers } from '@/hooks/useMutualEntityFollowers';
import { Users } from 'lucide-react';

interface MutualFollowersIndicatorProps {
  entityId: string;
}

export const MutualFollowersIndicator: React.FC<MutualFollowersIndicatorProps> = ({
  entityId
}) => {
  const { mutualFollowers, count, isLoading } = useMutualEntityFollowers(entityId);

  // Don't render if loading or no mutual followers
  if (isLoading || count === 0) {
    return null;
  }

  // Show max 3 avatars
  const displayFollowers = mutualFollowers.slice(0, 3);
  const remainingCount = Math.max(0, count - 3);

  const getDisplayName = (follower: typeof mutualFollowers[0]) => {
    if (follower.username) return follower.username;
    if (follower.first_name) {
      return follower.last_name 
        ? `${follower.first_name} ${follower.last_name}` 
        : follower.first_name;
    }
    return 'Friend';
  };

  const getInitials = (follower: typeof mutualFollowers[0]) => {
    const name = getDisplayName(follower);
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <Users className="w-4 h-4" />
        
        {/* Avatar Stack */}
        <div className="flex -space-x-2">
          {displayFollowers.map((follower, index) => (
            <Avatar key={follower.id} className="w-6 h-6 border-2 border-background">
              <AvatarImage 
                src={follower.avatar_url || undefined} 
                alt={getDisplayName(follower)}
              />
              <AvatarFallback className="text-xs">
                {getInitials(follower)}
              </AvatarFallback>
            </Avatar>
          ))}
          
          {remainingCount > 0 && (
            <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <span className="text-xs font-medium">+{remainingCount}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Text */}
      <span>
        {count === 1 ? (
          <>1 friend follows this</>
        ) : (
          <>{count} friends follow this</>
        )}
      </span>
    </div>
  );
};