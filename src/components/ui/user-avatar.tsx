
import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserCircle } from "lucide-react"

interface UserAvatarProps {
  username?: string | null
  imageUrl?: string | null
  className?: string
}

export function UserAvatar({ username, imageUrl, className }: UserAvatarProps) {
  return (
    <Avatar className={className}>
      <AvatarImage src={imageUrl || ""} alt={username || "User"} />
      <AvatarFallback className="bg-background">
        <UserCircle className="h-5 w-5 text-brand-orange" />
      </AvatarFallback>
    </Avatar>
  );
}
