
import React from 'react';
import { Edit } from 'lucide-react';

interface ProfileUserInfoProps {
  username: string;
  bio: string;
  isOwnProfile: boolean;
  formattedUsername?: string;
  onEditClick: () => void;
}

const ProfileUserInfo = ({ 
  username, 
  bio, 
  isOwnProfile, 
  formattedUsername, 
  onEditClick 
}: ProfileUserInfoProps) => {
  return (
    <>
      <div className="flex items-center mb-2">
        <h2 className="text-xl font-bold text-gray-900">{username}</h2>
        {isOwnProfile && (
          <button 
            onClick={onEditClick}
            className="ml-2 text-gray-500 hover:text-brand-orange"
          >
            <Edit size={18} />
          </button>
        )}
      </div>
      
      {/* Username display with @ symbol */}
      {formattedUsername && (
        <div className="text-sm text-gray-500 mb-2">{formattedUsername}</div>
      )}
      
      <p className="text-gray-600 mb-4 text-sm text-center">{bio}</p>
    </>
  );
};

export default ProfileUserInfo;
