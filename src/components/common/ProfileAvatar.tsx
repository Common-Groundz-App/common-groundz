
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
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm', 
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg'
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
        <AvatarFallback className={cn('bg-brand-orange text-white', fallbackClassName)}>
          AU
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
      <AvatarFallback className={cn('bg-brand-orange text-white font-semibold', fallbackClassName)}>
        {profile?.initials || 'AU'}
      </AvatarFallback>
    </Avatar>
  );
};
