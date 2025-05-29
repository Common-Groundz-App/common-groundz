
import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserCircle } from "lucide-react"
import { useProfile } from "@/hooks/use-profile-cache"

interface UserAvatarProps {
  userId?: string | null
  username?: string | null
  imageUrl?: string | null
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8', 
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
};

export function UserAvatar({ 
  userId, 
  username, 
  imageUrl, 
  className,
  size = 'md'
}: UserAvatarProps) {
  // Use profile cache if userId is provided
  const { data: profile } = useProfile(userId);
  
  // Determine which data to use (props take precedence for backwards compatibility)
  const finalImageUrl = imageUrl || profile?.avatar_url;
  const finalUsername = username || profile?.displayName || profile?.username || "User";
  const finalInitials = profile?.initials || finalUsername.substring(0, 2).toUpperCase();

  return (
    <Avatar className={`${sizeClasses[size]} ${className || ''}`}>
      <AvatarImage src={finalImageUrl || ""} alt={finalUsername} />
      <AvatarFallback className="bg-background">
        <UserCircle className="h-5 w-5 text-brand-orange" />
      </AvatarFallback>
    </Avatar>
  );
}
