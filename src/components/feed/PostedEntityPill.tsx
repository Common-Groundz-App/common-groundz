import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EntityImage } from '@/components/common/EntityImage';
import type { Entity } from '@/services/recommendation/types';
import { getEntityUrl } from '@/utils/entityUrlUtils';

interface PostedEntityPillProps {
  entity: Entity;
}

export const PostedEntityPill: React.FC<PostedEntityPillProps> = ({ entity }) => {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant="outline"
      aria-label={`View ${entity.name}`}
      className="h-10 max-w-full gap-1.5 rounded-full border-primary/20 bg-primary/5 px-1.5 pr-3.5 text-sm font-semibold text-foreground hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        navigate(getEntityUrl(entity));
      }}
    >
      <EntityImage entity={entity} decorative className="h-7 w-7" />
      <span className="max-w-[180px] truncate">{entity.name}</span>
    </Button>
  );
};