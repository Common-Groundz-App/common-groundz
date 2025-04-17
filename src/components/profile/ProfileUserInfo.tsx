
import React from 'react';
import { Button } from "@/components/ui/button";
import { Edit, CheckCircle } from 'lucide-react';

interface ProfileUserInfoProps {
  username: string;
  bio: string;
  isOwnProfile: boolean;
  formattedUsername?: string;
  onEditClick?: () => void;
  isVerified?: boolean;
}

const ProfileUserInfo = ({ 
  username, 
  bio, 
  isOwnProfile, 
  formattedUsername,
  onEditClick,
  isVerified = false
}: ProfileUserInfoProps) => {
  return (
    <div className="w-full text-center mb-6">
      <div className="flex items-center justify-center">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">{username}</h2>
        {isVerified && (
          <CheckCircle 
            size={16} 
            className="ml-1 text-brand-orange fill-brand-orange" 
            data-tooltip="Verified Account"
          />
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
