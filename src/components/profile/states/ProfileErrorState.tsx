
import React from 'react';

interface ProfileErrorStateProps {
  error?: Error | null;
}

const ProfileErrorState = ({ error }: ProfileErrorStateProps) => {
  return (
    <div className="container mx-auto py-12 px-4 text-center">
      <h2 className="text-xl font-bold text-red-500 mb-2">Error Loading Profile</h2>
      <p className="text-muted-foreground">
        {error?.message || 'Unable to load profile data. The user may not exist.'}
      </p>
    </div>
  );
};

export default ProfileErrorState;
