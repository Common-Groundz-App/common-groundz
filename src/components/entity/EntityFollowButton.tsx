
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { useEntityFollow } from '@/hooks/use-entity-follow';
import { useToast } from '@/hooks/use-toast';
import { trackGuestEvent } from '@/utils/guestConversionTracker';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';

interface EntityFollowButtonProps {
  entityId: string;
  entityName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export const EntityFollowButton: React.FC<EntityFollowButtonProps> = ({
  entityId,
  entityName,
  variant = 'outline',
  size = 'default'
}) => {
  const isMobile = useIsMobile();
  const [isHovering, setIsHovering] = useState(false);
  const { isFollowing, isLoading, toggleFollow, canFollow } = useEntityFollow(entityId);
  const { toast } = useToast();
  const { requireAuth } = useAuthPrompt();

  const iconSize = size === 'sm' ? 14 : 16;
  const iconMargin = size === 'sm' ? 'mr-0.5' : 'mr-1';
  const textClass = size === 'sm' ? 'text-xs' : '';

  const handleFollow = async () => {
    if (!canFollow) {
      trackGuestEvent('guest_attempted_follow', { entityId });
      if (!requireAuth({ action: 'follow', entityName, entityId, surface: 'entity_header' })) return;
    }

    try {
      await toggleFollow();
      toast({
        title: isFollowing ? "Unfollowed" : "Following",
        description: isFollowing 
          ? `You are no longer following ${entityName}` 
          : `You are now following ${entityName}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    }
  };

  return (
    <Button 
      size={isMobile ? "sm" : size} 
      variant="outline"
      className={`${textClass} ${
        isFollowing 
          ? `${isHovering ? 'border-red-500 text-red-500 hover:bg-red-50' : 'border-brand-orange text-brand-orange hover:bg-brand-orange/5'} transition-colors duration-200` 
          : "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white transition-all transform hover:scale-105"
      }`}
      onClick={handleFollow}
      disabled={isLoading}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {isFollowing ? (
        <>
          {isHovering ? (
            <UserMinus size={iconSize} className={iconMargin} />
          ) : (
            <UserCheck size={iconSize} className={iconMargin} />
          )}
          {isHovering ? 'Unfollow' : 'Following'}
        </>
      ) : (
        <>
          <UserPlus size={iconSize} className={iconMargin} /> Follow
        </>
      )}
    </Button>
  );
};
