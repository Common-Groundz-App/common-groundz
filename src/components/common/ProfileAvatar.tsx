
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useProfile } from '@/hooks/use-profile-cache';

interface ProfileAvatarProps {
  userId?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackText?: string;
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
  fallbackText 
}) => {
  const { data: profile, isLoading, error } = useProfile(userId);
  
  // Enhanced logging for debugging
  React.useEffect(() => {
    if (userId) {
      console.log('🖼️ [ProfileAvatar] Rendering for user:', {
        userId,
        profileLoaded: !!profile,
        isLoading,
        hasError: !!error,
        avatarUrl: profile?.avatar_url ? 'present' : 'missing',
        initials: profile?.initials,
        displayName: profile?.displayName
      });
    }
  }, [userId, profile, isLoading, error]);

  // Don't render if no userId provided
  if (!userId) {
    console.log('⚠️ [ProfileAvatar] No userId provided, rendering fallback');
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarFallback>{fallbackText || '?'}</AvatarFallback>
      </Avatar>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarFallback className="animate-pulse bg-muted">...</AvatarFallback>
      </Avatar>
    );
  }

  // Handle error state
  if (error) {
    console.error('❌ [ProfileAvatar] Error loading profile for user:', userId, error);
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
    );
  }

  // Generate avatar URL with cache busting for immediate updates
  const avatarUrl = profile?.avatar_url 
    ? `${profile.avatar_url}?t=${Date.now()}` 
    : null;

  // Use enhanced initials from the profile service
  const initials = profile?.initials || fallbackText || '?';

  console.log('🎨 [ProfileAvatar] Rendering avatar with:', {
    userId,
    avatarUrl: avatarUrl ? 'present' : 'missing',
    initials,
    displayName: profile?.displayName
  });

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl && (
        <AvatarImage 
          src={avatarUrl} 
          alt={profile?.displayName || 'Profile'} 
          className="object-cover"
          onError={(e) => {
            console.log('❌ [ProfileAvatar] Image failed to load for user:', userId, avatarUrl);
          }}
          onLoad={() => {
            console.log('✅ [ProfileAvatar] Image loaded successfully for user:', userId);
          }}
        />
      )}
      <AvatarFallback className="font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};
