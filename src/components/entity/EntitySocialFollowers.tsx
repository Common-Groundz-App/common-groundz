import React, { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useEntityFollowerNames } from '@/hooks/useEntityFollowerNames';
import type { EntityFollowerProfile } from '@/services/entityFollowService';
import { Button } from '@/components/ui/button';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';

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

const FollowerName: React.FC<{ follower: EntityFollowerProfile; index: number }> = React.memo(({ follower, index }) => {
  const displayName = useMemo(() => getDisplayName(follower), [follower]);
  const animationDelay = useMemo(() => ({ animationDelay: `${index * 100}ms` }), [index]);
  
  return (
    <Link 
      to={`/profile/${follower.id}`}
      className="hover:underline hover:text-primary transition-all duration-200 inline-flex items-baseline gap-1.5 group animate-fade-in hover-scale"
      style={animationDelay}
    >
      <ProfileAvatar 
        userId={follower.id}
        size="xs"
        className="flex-shrink-0 group-hover:scale-110 transition-transform duration-200"
        showSkeleton={false}
      />
      <span className="leading-none">{displayName}</span>
    </Link>
  );
});

FollowerName.displayName = 'FollowerName';

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

export const EntitySocialFollowers: React.FC<EntitySocialFollowersProps> = React.memo(({
  entityId,
  className = ''
}) => {
  const { followerNames, totalFollowersCount, isLoading, error, retry } = useEntityFollowerNames(entityId, 3);

  // Memoized calculations
  const messageSuffix = useMemo(() => 
    formatFollowerMessage(followerNames, totalFollowersCount).text, 
    [followerNames, totalFollowersCount]
  );

  const messageSuffixDelay = useMemo(() => 
    ({ animationDelay: `${followerNames.length * 100}ms` }), 
    [followerNames.length]
  );

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
    <div className={`text-sm text-muted-foreground animate-fade-in ${className}`}>
      {followerNames.map((follower, index) => (
        <React.Fragment key={follower.id}>
          {index > 0 && index === followerNames.length - 1 && followerNames.length > 1 && ' and '}
          {index > 0 && index < followerNames.length - 1 && ', '}
          <FollowerName follower={follower} index={index} />
        </React.Fragment>
      ))}
      <span className="animate-fade-in" style={messageSuffixDelay}>
        {messageSuffix}
      </span>
    </div>
  );
});

EntitySocialFollowers.displayName = 'EntitySocialFollowers';