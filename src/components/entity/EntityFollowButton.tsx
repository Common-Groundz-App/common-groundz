
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { useEntityFollow } from '@/hooks/use-entity-follow';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

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

  const handleFollow = async () => {
    if (!canFollow) {
      toast({
        title: "Authentication required",
        description: "Please sign in to follow entities",
        variant: "destructive",
      });
      return;
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
      size={isMobile ? "sm" : "default"} 
      className={
        isFollowing 
          ? `${isHovering ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'} transition-colors duration-200` 
          : "bg-brand-orange hover:bg-brand-orange/90 transition-all transform hover:scale-105"
      }
      onClick={handleFollow}
      disabled={isLoading}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {isFollowing ? (
        <>
          {isHovering ? (
            <UserMinus size={16} className="mr-1" />
          ) : (
            <UserCheck size={16} className="mr-1" />
          )}
          {isHovering ? 'Unfollow' : 'Following'}
        </>
      ) : (
        <>
          <UserPlus size={16} className="mr-1" /> Follow
        </>
      )}
    </Button>
  );
};
