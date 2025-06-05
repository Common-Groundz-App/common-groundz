
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
  const { data: profile, isLoading, error } = useProfile(userId);

  console.log("ProfileAvatar rendering for user:", userId, "profile data:", profile);

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

  if (error) {
    console.error("ProfileAvatar error for user:", userId, error);
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarFallback className={cn('bg-brand-orange text-white', fallbackClassName)}>
          AU
        </AvatarFallback>
      </Avatar>
    );
  }

  // Use the avatar URL without cache busting timestamp to prevent flickering
  const avatarUrl = profile?.avatar_url || '';

  console.log("ProfileAvatar displaying:", {
    userId,
    avatarUrl,
    displayName: profile?.displayName,
    initials: profile?.initials
  });

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage 
        src={avatarUrl} 
        alt={profile?.displayName || 'User'}
        onError={(e) => {
          console.error("Avatar image failed to load:", avatarUrl, "for user:", userId);
        }}
        onLoad={() => {
          console.log("Avatar image loaded successfully:", avatarUrl, "for user:", userId);
        }}
      />
      <AvatarFallback className={cn('bg-brand-orange text-white font-semibold', fallbackClassName)}>
        {profile?.initials || 'AU'}
      </AvatarFallback>
    </Avatar>
  );
};
