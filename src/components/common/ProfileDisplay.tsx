
import React from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { useProfile } from '@/hooks/use-profile-cache';
import UsernameLink from './UsernameLink';
import { cn } from '@/lib/utils';
import { ProfileErrorBoundary } from './ProfileErrorBoundary';

interface ProfileDisplayProps {
  userId: string | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showUsername?: boolean;
  showLink?: boolean;
  className?: string;
  avatarClassName?: string;
  usernameClassName?: string;
  direction?: 'horizontal' | 'vertical';
  spacing?: 'tight' | 'normal' | 'loose';
}

const spacingClasses = {
  tight: 'gap-1',
  normal: 'gap-2', 
  loose: 'gap-3'
};

const ProfileDisplayContent: React.FC<ProfileDisplayProps> = ({
  userId,
  size = 'md',
  showUsername = true,
  showLink = true,
  className,
  avatarClassName,
  usernameClassName,
  direction = 'horizontal',
  spacing = 'normal'
}) => {
  const { data: profile, isLoading, error } = useProfile(userId);

  const containerClasses = cn(
    'flex items-center',
    direction === 'vertical' ? 'flex-col' : 'flex-row',
    spacingClasses[spacing],
    className
  );

  // Handle loading state
  if (isLoading) {
    return (
      <div className={containerClasses}>
        <ProfileAvatar userId={null} size={size} className={cn('animate-pulse', avatarClassName)} />
        {showUsername && (
          <span className={cn('text-muted-foreground animate-pulse', usernameClassName)}>
            Loading...
          </span>
        )}
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className={containerClasses}>
        <ProfileAvatar userId={null} size={size} className={avatarClassName} />
        {showUsername && (
          <span className={cn('text-muted-foreground', usernameClassName)}>
            Error loading user
          </span>
        )}
      </div>
    );
  }

  if (!userId) {
    return (
      <div className={containerClasses}>
        <ProfileAvatar userId={null} size={size} className={avatarClassName} />
        {showUsername && (
          <span className={cn('text-muted-foreground', usernameClassName)}>
            Unknown User
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <ProfileAvatar userId={userId} size={size} className={avatarClassName} />
      {showUsername && (
        <div className={cn('min-w-0 flex-1', usernameClassName)}>
          {showLink ? (
            <UsernameLink
              username={profile?.displayName}
              userId={userId}
              className="truncate"
              fallback="Unknown User"
            />
          ) : (
            <span className="text-sm font-medium truncate">
              {profile?.displayName || 'Unknown User'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const ProfileDisplay: React.FC<ProfileDisplayProps> = (props) => {
  return (
    <ProfileErrorBoundary
      fallback={
        <div className={cn('flex items-center gap-2', props.className)}>
          <ProfileAvatar userId={null} size={props.size} className={props.avatarClassName} />
          {props.showUsername && (
            <span className={cn('text-muted-foreground', props.usernameClassName)}>
              Error
            </span>
          )}
        </div>
      }
    >
      <ProfileDisplayContent {...props} />
    </ProfileErrorBoundary>
  );
};
