
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  onNavigate?: (userId: string) => void;
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
  currentUserId,
  onNavigate
}: UserCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  
  // Don't show follow button if viewing your own card
  const isViewingOwnUser = currentUserId === id;
  
  console.log('UserCard Debug:', { id, username, isFollowing, relationshipType, isViewingOwnUser });
  
  // Get the follow button props based on relationship and follow status
  const getFollowButtonProps = () => {
    // Don't show any follow button if viewing your own card
    if (isViewingOwnUser) {
      return null;
    }
    
    // In "Following" modal context - these are people the profile user follows
    if (relationshipType === 'following') {
      // The current user's relationship with people in the following list
      if (isFollowing) {
        // Current user also follows this person (mutual follow)
        return {
          variant: isHovering ? "destructive" : "outline",
          text: isHovering ? "Unfollow" : "Following",
          icon: isHovering ? <UserMinus size={14} className="mr-1" /> : <UserCheck size={14} className="mr-1" />,
          className: "min-w-20 transition-all"
        };
      } else {
        // Current user doesn't follow this person yet
        return {
          variant: "default",
          text: "Follow",
          icon: <UserPlus size={14} className="mr-1" />,
          className: "min-w-20 bg-brand-orange hover:bg-brand-orange/90 transition-all transform hover:scale-105"
        };
      }
    }
    
    // In "Followers" modal context - these are people who follow the profile user
    if (relationshipType === 'follower') {
      if (isFollowing) {
        // Current user already follows this follower back (mutual follow)
        return {
          variant: isHovering ? "destructive" : "outline",
          text: isHovering ? "Unfollow" : "Following",
          icon: isHovering ? <UserMinus size={14} className="mr-1" /> : <UserCheck size={14} className="mr-1" />,
          className: "min-w-20 transition-all"
        };
      } else {
        // Current user doesn't follow this follower back
        return {
          variant: "default",
          text: "Follow Back",
          icon: <UserPlus size={14} className="mr-1" />,
          className: "min-w-22 bg-brand-orange hover:bg-brand-orange/90 transition-all transform hover:scale-105"
        };
      }
    }
    
    // Default case: general follow button
    if (isFollowing) {
      return {
        variant: isHovering ? "destructive" : "outline",
        text: isHovering ? "Unfollow" : "Following",
        icon: isHovering ? <UserMinus size={14} className="mr-1" /> : <UserCheck size={14} className="mr-1" />,
        className: "min-w-20 transition-all"
      };
    } else {
      return {
        variant: "default",
        text: "Follow",
        icon: <UserPlus size={14} className="mr-1" />,
        className: "min-w-20 bg-brand-orange hover:bg-brand-orange/90 transition-all transform hover:scale-105"
      };
    }
  };
  
  const followButtonProps = getFollowButtonProps();
  
  // Handle follow button click without triggering navigation
  const handleFollowButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFollowToggle(id, !!isFollowing);
  };

  // Handle card click to navigate to profile
  const handleCardClick = (e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(id);
    }
  };

  const formattedUsername = username ? `@${username.toLowerCase().replace(/\s+/g, '')}` : '@user';

  return (
    <Link to={`/profile/${id}`} className="block" onClick={handleCardClick}>
      <div className="py-3 px-4 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors">
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
            <div className="font-medium text-foreground">{username || 'User'}</div>
            <div className="text-xs text-muted-foreground">{formattedUsername}</div>
          </div>
        </div>
        
        {/* Action buttons */}
        {currentUserId && followButtonProps && (
          <Button 
            variant={followButtonProps.variant as any}
            size="sm"
            onClick={handleFollowButtonClick}
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
    </Link>
  );
};

export default UserCard;
