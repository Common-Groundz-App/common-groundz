
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/use-profile-cache';
import { cn } from '@/lib/utils';

interface ProfileAvatarProps {
  userId: string | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackClassName?: string;
  showTooltip?: boolean;
}

const sizeClasses = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8', 
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
};

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  userId,
  size = 'md',
  className,
  fallbackClassName,
  showTooltip = false
}) => {
  const { data: profile, isLoading } = useProfile(userId);

  if (!userId) {
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarFallback className={cn('bg-muted', fallbackClassName)}>
          ?
        </AvatarFallback>
      </Avatar>
    );
  }

  if (isLoading) {
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarFallback className={cn('bg-muted animate-pulse', fallbackClassName)}>
          ...
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage 
        src={profile?.avatar_url || ''} 
        alt={profile?.displayName || 'User'} 
      />
      <AvatarFallback className={cn('bg-brand-orange text-white', fallbackClassName)}>
        {profile?.initials || '?'}
      </AvatarFallback>
    </Avatar>
  );
};
