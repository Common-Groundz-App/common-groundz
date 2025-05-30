
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface FollowButtonProps {
  isFollowing: boolean;
  isLoading: boolean;
  onFollowToggle: () => void;
}

const FollowButton = ({ 
  isFollowing, 
  isLoading, 
  onFollowToggle 
}: FollowButtonProps) => {
  const isMobile = useIsMobile();
  const [isHovering, setIsHovering] = useState(false);
  
  return (
    <Button 
      size={isMobile ? "sm" : "default"} 
      className={
        isFollowing 
          ? `${isHovering ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'} transition-colors duration-200` 
          : "bg-brand-orange hover:bg-brand-orange/90 transition-all transform hover:scale-105"
      }
      onClick={onFollowToggle}
      disabled={isLoading}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {isFollowing ? (
        <>
          {isHovering ? (
            <UserMinus size={16} className="mr-1" />
          ) : (
            <UserCheck size={16} className="mr-1" />
          )}
          {isHovering ? 'Unfollow' : 'Following'}
        </>
      ) : (
        <>
          <UserPlus size={16} className="mr-1" /> Follow
        </>
      )}
    </Button>
  );
};

export default FollowButton;
