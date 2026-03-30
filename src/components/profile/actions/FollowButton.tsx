
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface FollowButtonProps {
  isFollowing: boolean;
  isLoading: boolean;
  onFollowToggle: () => void;
  size?: 'sm' | 'default';
}

const FollowButton = ({ 
  isFollowing, 
  isLoading, 
  onFollowToggle,
  size 
}: FollowButtonProps) => {
  const isMobile = useIsMobile();
  const [isHovering, setIsHovering] = useState(false);
  const resolvedSize = size ?? (isMobile ? "sm" : "default");
  
  return (
    <Button 
      size={resolvedSize} 
      className={
        isFollowing 
          ? `${isHovering ? 'border border-red-500 text-red-500 bg-transparent hover:bg-red-50 dark:hover:bg-red-500/10' : 'bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/15'} transition-colors duration-200` 
          : "bg-brand-orange text-white hover:bg-brand-orange/90 hover:shadow-md transition-all transform hover:scale-105"
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
