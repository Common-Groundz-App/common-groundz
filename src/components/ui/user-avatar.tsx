
import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserAvatarProps {
  username?: string | null
  imageUrl?: string | null
  className?: string
}

export function UserAvatar({ username, imageUrl, className }: UserAvatarProps) {
  // Get initials from username
  const getInitials = () => {
    if (!username) return 'U';
    
    const words = username.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <Avatar className={className}>
      <AvatarImage src={imageUrl || ""} alt={username || "User"} />
      <AvatarFallback className="bg-brand-orange text-white">
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}
