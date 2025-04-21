
import React from 'react';

const ProfileLoadingState = () => {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md mb-6"></div>
      <div className="w-1/3 h-8 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md mx-auto mb-8"></div>
      <div className="w-full h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md"></div>
    </div>
  );
};

export default ProfileLoadingState;
