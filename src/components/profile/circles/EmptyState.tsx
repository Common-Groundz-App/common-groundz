
import React from 'react';

interface EmptyStateProps {
  type: 'followers' | 'following';
}

const EmptyState = ({ type }: EmptyStateProps) => {
  return (
    <div className="text-center py-8 text-gray-500">
      {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
    </div>
  );
};

export default EmptyState;
