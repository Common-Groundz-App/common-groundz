
import React, { useState } from 'react';
import { useEntityFollow } from '@/hooks/use-entity-follow';
import { EntityFollowerModal } from './EntityFollowerModal';
import { formatCount } from '@/lib/utils';

interface EntityFollowersCountProps {
  entityId: string;
}

export const EntityFollowersCount: React.FC<EntityFollowersCountProps> = ({ entityId }) => {
  const { followersCount } = useEntityFollow(entityId);
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    if (followersCount > 0) {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="text-foreground hover:text-brand-orange hover:underline font-medium cursor-pointer transition-colors disabled:cursor-default disabled:hover:text-muted-foreground disabled:hover:no-underline"
        disabled={followersCount === 0}
      >
        {formatCount(followersCount, 'follower')}
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
