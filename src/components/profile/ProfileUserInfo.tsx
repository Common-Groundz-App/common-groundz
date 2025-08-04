
import React from 'react';
import { Button } from "@/components/ui/button";
import { Edit, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTooltip } from '@/components/ui/info-tooltip';

interface ProfileUserInfoProps {
  username: string;
  bio: string;
  isOwnProfile: boolean;
  formattedUsername?: string;
  onEditClick?: () => void;
  isVerified?: boolean;
  displayName?: string;
  isLoading?: boolean; // New loading state prop
}

const ProfileUserInfo = ({ 
  username, 
  bio, 
  isOwnProfile, 
  formattedUsername,
  onEditClick,
  isVerified = false,
  displayName,
  isLoading = false
}: ProfileUserInfoProps) => {
  if (isLoading) {
    return (
      <div className="w-full text-center mb-6">
        <div className="flex items-center justify-center mb-2">
          <Skeleton className="h-8 w-32" />
        </div>
        {formattedUsername && <Skeleton className="h-4 w-24 mx-auto mb-2" />}
        <Skeleton className="h-16 w-full max-w-sm mx-auto mt-4" />
      </div>
    );
  }

  return (
    <div className="w-full text-center mb-6">
      <div className="flex items-center justify-center">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {displayName || username}
        </h2>
        {isVerified && (
          <div className="ml-1 flex items-center">
            <CheckCircle 
              size={16} 
              className="text-brand-orange fill-brand-orange" 
            />
            <InfoTooltip content="Verified Account" side="top" />
          </div>
        )}
        {isOwnProfile && onEditClick && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 ml-1" 
            onClick={onEditClick}
          >
            <Edit size={16} />
          </Button>
        )}
      </div>
      
      {formattedUsername && (
        <p className="text-sm text-muted-foreground mb-2">{formattedUsername}</p>
      )}
      
      <p className="text-muted-foreground mt-4 px-4">{bio || 'No bio yet'}</p>
    </div>
  );
};

export default ProfileUserInfo;
