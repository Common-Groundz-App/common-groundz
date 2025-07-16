import React, { useState } from 'react';
import { useEntityFollow } from '@/hooks/use-entity-follow';
import { EntityFollowerModal } from './EntityFollowerModal';

interface EntityFollowersCountProps {
  entityId: string;
}

export const EntityFollowersCount: React.FC<EntityFollowersCountProps> = ({ entityId }) => {
  const { followersCount } = useEntityFollow(entityId);
  const [showModal, setShowModal] = useState(false);

  const handleCountClick = () => {
    if (followersCount > 0) {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleCountClick}
        className="text-primary hover:underline font-medium cursor-pointer"
        disabled={followersCount === 0}
      >
        {followersCount}
      </button>

      <EntityFollowerModal
        open={showModal}
        onOpenChange={setShowModal}
        entityId={entityId}
        totalFollowersCount={followersCount}
      />
    </>
  );
};