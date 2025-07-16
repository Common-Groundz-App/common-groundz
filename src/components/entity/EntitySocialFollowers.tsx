import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useEntityFollowerNames } from '@/hooks/useEntityFollowerNames';
import type { EntityFollowerProfile } from '@/services/entityFollowService';
import { Button } from '@/components/ui/button';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { EntityFollowerModal } from './EntityFollowerModal';

interface EntitySocialFollowersProps {
  entityId: string;
  className?: string;
}

const getDisplayName = (follower: EntityFollowerProfile): string => {
  if (follower.first_name && follower.last_name) {
    return `${follower.first_name} ${follower.last_name}`;
  }
  if (follower.first_name) {
    return follower.first_name;
  }
  if (follower.username) {
    return follower.username;
  }
  return 'Someone';
};

const FollowerAvatar: React.FC<{ follower: EntityFollowerProfile; index: number }> = React.memo(({ follower, index }) => {
  return (
    <Link 
      to={`/profile/${follower.id}`}
      className="relative group animate-fade-in hover-scale transition-all duration-200"
      style={{ 
        animationDelay: `${index * 100}ms`,
        marginLeft: index > 0 ? '-0.5rem' : '0'
      }}
    >
      <ProfileAvatar 
        userId={follower.id}
        size="sm"
        className="border-2 border-background group-hover:scale-110 transition-transform duration-200 ring-1 ring-border/20"
        showSkeleton={false}
      />
    </Link>
  );
});

const formatFollowerMessage = (
  followers: EntityFollowerProfile[], 
  totalCount: number
): { text: string; remainingCount: number } => {
  if (followers.length === 0) {
    return { text: '', remainingCount: 0 };
  }

  const remainingCount = Math.max(0, totalCount - followers.length);
  const names = followers.map(follower => getDisplayName(follower));

  if (followers.length === 1) {
    if (remainingCount > 0) {
      return { 
        text: `Followed by ${names[0]} and ${remainingCount} other${remainingCount === 1 ? '' : 's'}`, 
        remainingCount 
      };
    }
    return { text: `Followed by ${names[0]}`, remainingCount };
  }

  if (followers.length === 2) {
    if (remainingCount > 0) {
      return { 
        text: `Followed by ${names[0]}, ${names[1]} and ${remainingCount} other${remainingCount === 1 ? '' : 's'}`, 
        remainingCount 
      };
    }
    return { text: `Followed by ${names[0]} and ${names[1]}`, remainingCount };
  }

  // 3 or more followers shown
  const firstTwo = names.slice(0, 2).join(', ');
  if (remainingCount > 0) {
    return { 
      text: `Followed by ${firstTwo} and ${remainingCount} other${remainingCount === 1 ? '' : 's'}`, 
      remainingCount 
    };
  }
  
  return { 
    text: `Followed by ${firstTwo} and ${names.length - 2} other${names.length - 2 === 1 ? '' : 's'}`, 
    remainingCount 
  };
};

export const EntitySocialFollowers: React.FC<EntitySocialFollowersProps> = React.memo(({
  entityId,
  className = ''
}) => {
  const { followerNames, totalFollowersCount, isLoading, error, retry } = useEntityFollowerNames(entityId, 3);
  const [showModal, setShowModal] = useState(false);

  const messageSuffix = useMemo(() => 
    formatFollowerMessage(followerNames, totalFollowersCount).text,
    [followerNames, totalFollowersCount]
  );

  const handleFollowerCountClick = () => {
    if (totalFollowersCount > 0) {
      setShowModal(true);
    }
  };

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className={`text-sm text-muted-foreground animate-fade-in ${className}`}>
        <div className="animate-pulse bg-muted h-4 w-48 rounded-md"></div>
      </div>
    );
  }

  // Error state with retry option
  if (error) {
    return (
      <div className={`text-sm text-muted-foreground animate-fade-in ${className} flex items-center gap-2`}>
        <span>Failed to load followers</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={retry}
          className="h-auto p-1 text-xs hover:text-primary hover-scale transition-all duration-200 hover:bg-muted/50"
        >
          <RefreshCw className="h-3 w-3 transition-transform duration-200 hover:rotate-180" />
        </Button>
      </div>
    );
  }

  // No followers state
  if (followerNames.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground animate-fade-in ${className}`}>
        Be the first from your circle to follow this!
      </div>
    );
  }

  return (
    <>
      <div className={`flex items-center gap-2 text-sm text-muted-foreground animate-fade-in ${className}`}>
        {/* Avatar row */}
        <div className="flex items-center">
          {followerNames.map((follower, index) => (
            <FollowerAvatar key={follower.id} follower={follower} index={index} />
          ))}
        </div>
        
        {/* Text message */}
        <span 
          className="animate-fade-in cursor-pointer hover:text-primary hover:underline transition-all duration-200 leading-tight" 
          style={{ animationDelay: `${followerNames.length * 100}ms` }}
          onClick={handleFollowerCountClick}
        >
          {messageSuffix}
        </span>
      </div>

      <EntityFollowerModal
        open={showModal}
        onOpenChange={setShowModal}
        entityId={entityId}
        totalFollowersCount={totalFollowersCount}
      />
    </>
  );
});