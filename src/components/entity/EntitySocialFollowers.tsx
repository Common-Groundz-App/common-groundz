import React from 'react';
import { useEntityFollowerNames } from '@/hooks/useEntityFollowerNames';
import type { EntityFollowerProfile } from '@/services/entityFollowService';

interface EntitySocialFollowersProps {
  entityId: string;
  className?: string;
}

const formatFollowerNames = (followers: EntityFollowerProfile[]): string => {
  if (followers.length === 0) {
    return '';
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

  const displayNames = followers.map(getDisplayName);

  if (displayNames.length === 1) {
    return `${displayNames[0]} follows this`;
  }

  if (displayNames.length === 2) {
    return `${displayNames[0]} and ${displayNames[1]} follow this`;
  }

  if (displayNames.length === 3) {
    return `${displayNames[0]}, ${displayNames[1]} and ${displayNames[2]} follow this`;
  }

  // This shouldn't happen with our limit of 3, but just in case
  return `${displayNames[0]} and ${displayNames.length - 1} others follow this`;
};

export const EntitySocialFollowers: React.FC<EntitySocialFollowersProps> = ({
  entityId,
  className = ''
}) => {
  const { followerNames, isLoading } = useEntityFollowerNames(entityId, 3);

  if (isLoading) {
    return null; // Don't show anything while loading
  }

  const message = followerNames.length === 0 
    ? "Be the first from your circle to follow this!"
    : formatFollowerNames(followerNames);

  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      {message}
    </div>
  );
};