
import React from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, UserMinus } from 'lucide-react';

interface UserCardProps {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  isFollowing?: boolean;
  relationshipType: 'follower' | 'following';
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
  return (
    <Card key={id}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Avatar>
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={username || 'User'} />
            ) : (
              <AvatarFallback className="bg-brand-orange text-white">
                {getUserInitials(username)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="ml-4">
            <div className="font-medium">{username || 'User'}</div>
            <div className="text-sm text-gray-500">{relationshipType === 'follower' ? 'Follower' : 'Following'}</div>
          </div>
        </div>
        
        {currentUserId && currentUserId !== id && !isOwnProfile && (
          <Button 
            variant={isFollowing ? "outline" : "default"}
            size="sm"
            onClick={() => onFollowToggle(id, !!isFollowing)}
            disabled={isLoading}
          >
            {isFollowing ? (
              <>
                <UserMinus size={14} className="mr-1" /> Unfollow
              </>
            ) : (
              <>
                <UserPlus size={14} className="mr-1" /> Follow
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default UserCard;
