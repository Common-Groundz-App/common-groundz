
import React from 'react';
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus } from 'lucide-react';
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
  
  return (
    <Button 
      size={isMobile ? "sm" : "default"} 
      className={isFollowing ? "bg-gray-600 hover:bg-gray-700" : "bg-brand-orange hover:bg-brand-orange/90"}
      onClick={onFollowToggle}
      disabled={isLoading}
    >
      {isFollowing ? (
        <>
          <UserMinus size={16} className="mr-1" /> Unfollow
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
