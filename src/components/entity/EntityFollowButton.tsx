
import React from 'react';
import { Button } from '@/components/ui/button';
import { Heart, Users } from 'lucide-react';
import { useEntityFollow } from '@/hooks/use-entity-follow';
import { useToast } from '@/hooks/use-toast';
import { EntitySocialFollowers } from './EntitySocialFollowers';

interface EntityFollowButtonProps {
  entityId: string;
  entityName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showCount?: boolean;
}

export const EntityFollowButton: React.FC<EntityFollowButtonProps> = ({
  entityId,
  entityName,
  variant = 'outline',
  size = 'default',
  showCount = false
}) => {
  const { isFollowing, followersCount, isLoading, toggleFollow, canFollow } = useEntityFollow(entityId);
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
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleFollow}
          variant={isFollowing ? 'default' : variant}
          size={size}
          disabled={isLoading}
          className={`gap-2 ${
            isFollowing 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : ''
          }`}
        >
          <Heart 
            className={`h-4 w-4 ${
              isFollowing ? 'fill-current' : ''
            }`} 
          />
          {isFollowing ? 'Following' : 'Follow'}
        </Button>

        {showCount && followersCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{followersCount}</span>
          </div>
        )}
      </div>
      
      <EntitySocialFollowers entityId={entityId} />
    </div>
  );
};
