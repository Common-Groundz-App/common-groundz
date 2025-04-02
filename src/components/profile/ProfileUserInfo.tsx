
import React from 'react';
import { Button } from "@/components/ui/button";
import { Edit } from 'lucide-react';

interface ProfileUserInfoProps {
  username: string;
  bio: string;
  isOwnProfile: boolean;
  formattedUsername?: string;
  onEditClick?: () => void;
  mutualFollows?: {
    count: number;
    examples: string[];
  };
}

const ProfileUserInfo = ({ 
  username, 
  bio, 
  isOwnProfile, 
  formattedUsername,
  onEditClick,
  mutualFollows
}: ProfileUserInfoProps) => {
  return (
    <div className="w-full text-center mb-6">
      <div className="flex items-center justify-center">
        <h2 className="text-xl md:text-2xl font-bold">{username}</h2>
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
        <p className="text-sm text-gray-500 mb-2">{formattedUsername}</p>
      )}
      
      {mutualFollows && mutualFollows.count > 0 && (
        <p className="text-xs text-gray-600 mb-3">
          {mutualFollows.examples.length > 0 ? (
            <>
              Followed by <span className="font-medium">{mutualFollows.examples[0]}</span>
              {mutualFollows.count > 1 && <> and <span className="font-medium">{mutualFollows.count - 1} {mutualFollows.count === 2 ? 'other' : 'others'}</span> you follow</>}
            </>
          ) : (
            <>Followed by {mutualFollows.count} {mutualFollows.count === 1 ? 'person' : 'people'} you follow</>
          )}
        </p>
      )}
      
      <p className="text-gray-600 mt-3 px-4">{bio || 'No bio yet'}</p>
    </div>
  );
};

export default ProfileUserInfo;
