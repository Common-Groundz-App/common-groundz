
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';

interface UserCardProps {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  isFollowing?: boolean;
  relationshipType?: 'follower' | 'following';
  onFollowToggle: (userId: string, isFollowing: boolean) => void;
  isLoading: boolean;
  isOwnProfile: boolean;
  currentUserId?: string;
}

export const getUserInitials = (username: string | null) => {
  if (!username) return 'U';
  
  const words = username.trim().split(' ');
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const UserCard = ({ 
  id, 
  username, 
  avatarUrl, 
  isFollowing, 
  relationshipType,
  onFollowToggle, 
  isLoading,
  isOwnProfile,
  currentUserId
}: UserCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  
  // Determine if this user follows the current user (for "Follow Back" logic)
  const isFollower = relationshipType === 'follower';
  
  // Get the follow button text and style based on relationship
  const getFollowButtonProps = () => {
    // User is already following this person
    if (isFollowing) {
      return {
        variant: isHovering ? "destructive" : "outline",
        text: isHovering ? "Unfollow" : "Following",
        icon: isHovering ? <UserMinus size={14} className="mr-1" /> : <UserCheck size={14} className="mr-1" />,
        className: "min-w-20 transition-all"
      };
    }
    
    // This person follows the user but user doesn't follow back
    if (isFollower && !isFollowing) {
      return {
        variant: "default",
        text: "Follow Back",
        icon: <UserPlus size={14} className="mr-1" />,
        className: "min-w-22 bg-brand-orange hover:bg-brand-orange/90"
      };
    }
    
    // Default case: user doesn't follow this person
    return {
      variant: "default",
      text: "Follow",
      icon: <UserPlus size={14} className="mr-1" />,
      className: "min-w-20"
    };
  };
  
  const followButtonProps = getFollowButtonProps();

  return (
    <div className="py-3 px-4 flex items-center justify-between">
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={username || 'User'} />
          ) : (
            <AvatarFallback className="bg-brand-orange text-white text-xs">
              {getUserInitials(username)}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="ml-3">
          <div className="font-medium">{username || 'User'}</div>
          <div className="text-xs text-gray-500">@{username?.toLowerCase().replace(/\s+/g, '') || 'user'}</div>
        </div>
      </div>
      
      {currentUserId && currentUserId !== id && !isOwnProfile && (
        <Button 
          variant={followButtonProps.variant as any}
          size="sm"
          onClick={() => onFollowToggle(id, !!isFollowing)}
          disabled={isLoading}
          className={followButtonProps.className}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {followButtonProps.icon}
          {followButtonProps.text}
        </Button>
      )}
    </div>
  );
};

export default UserCard;
