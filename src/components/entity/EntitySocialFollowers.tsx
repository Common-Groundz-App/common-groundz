import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useEntityFollowerNames } from '@/hooks/useEntityFollowerNames';
import type { EntityFollowerProfile } from '@/services/entityFollowService';
import { Button } from '@/components/ui/button';

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

const FollowerName: React.FC<{ follower: EntityFollowerProfile }> = ({ follower }) => {
  return (
    <Link 
      to={`/profile/${follower.id}`}
      className="hover:underline hover:text-primary transition-colors"
    >
      {getDisplayName(follower)}
    </Link>
  );
};

const formatFollowerMessage = (
  followers: EntityFollowerProfile[], 
  totalCount: number
): { text: string; remainingCount: number } => {
  if (followers.length === 0) {
    return { text: '', remainingCount: 0 };
  }

  const remainingCount = Math.max(0, totalCount - followers.length);

  if (followers.length === 1) {
    const suffix = remainingCount > 0 
      ? ` and ${remainingCount} other${remainingCount === 1 ? '' : 's'} follow this`
      : ' follows this';
    return { text: suffix, remainingCount };
  }

  if (followers.length === 2) {
    const suffix = remainingCount > 0
      ? ` and ${remainingCount} other${remainingCount === 1 ? '' : 's'} follow this`
      : ' follow this';
    return { text: ` and ${suffix}`, remainingCount };
  }

  // 3 or more followers shown
  const suffix = remainingCount > 0
    ? ` and ${remainingCount} other${remainingCount === 1 ? '' : 's'} follow this`
    : ' follow this';
  return { text: `, ${suffix}`, remainingCount };
};

export const EntitySocialFollowers: React.FC<EntitySocialFollowersProps> = ({
  entityId,
  className = ''
}) => {
  const { followerNames, totalFollowersCount, isLoading, error, retry } = useEntityFollowerNames(entityId, 3);

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        <div className="animate-pulse bg-muted h-4 w-48 rounded"></div>
      </div>
    );
  }

  // Error state with retry option
  if (error) {
    return (
      <div className={`text-sm text-muted-foreground ${className} flex items-center gap-2`}>
        <span>Failed to load followers</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={retry}
          className="h-auto p-1 text-xs hover:text-primary"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // No followers state
  if (followerNames.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        Be the first from your circle to follow this!
      </div>
    );
  }

  const { text: messageSuffix } = formatFollowerMessage(followerNames, totalFollowersCount);

  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      {followerNames.map((follower, index) => (
        <React.Fragment key={follower.id}>
          {index > 0 && index === followerNames.length - 1 && followerNames.length > 1 && ' and '}
          {index > 0 && index < followerNames.length - 1 && ', '}
          <FollowerName follower={follower} />
        </React.Fragment>
      ))}
      {messageSuffix}
    </div>
  );
};