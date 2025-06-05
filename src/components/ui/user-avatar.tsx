
import * as React from "react"
import { ProfileAvatar } from "@/components/common/ProfileAvatar"

interface UserAvatarProps {
  userId?: string | null
  username?: string | null
  imageUrl?: string | null
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export function UserAvatar({ 
  userId, 
  username, 
  imageUrl, 
  className,
  size = 'md'
}: UserAvatarProps) {
  console.log("UserAvatar component called with:", { userId, username, imageUrl });
  
  // Use the standardized ProfileAvatar component
  return (
    <ProfileAvatar 
      userId={userId}
      size={size}
      className={className}
    />
  );
}
