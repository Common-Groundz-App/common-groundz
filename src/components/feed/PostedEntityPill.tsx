import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EntityImage } from '@/components/common/EntityImage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Entity } from '@/services/recommendation/types';
import { getEntityUrl } from '@/utils/entityUrlUtils';

interface PostedEntityPillProps {
  entity: Entity;
}

export const PostedEntityPill: React.FC<PostedEntityPillProps> = ({ entity }) => {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const measureTruncation = useCallback(() => {
    const label = labelRef.current;
    const button = buttonRef.current;
    if (!label || !button) return;
    setIsTruncated(
      label.scrollWidth > label.clientWidth || button.scrollWidth > button.clientWidth,
    );
  }, []);

  useEffect(() => {
    measureTruncation();

    const label = labelRef.current;
    if (!label || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureTruncation);
      return () => window.removeEventListener('resize', measureTruncation);
    }

    const observer = new ResizeObserver(measureTruncation);
    observer.observe(label);
    return () => observer.disconnect();
  }, [entity.name, measureTruncation]);

  const pill = (
    <Button
      ref={buttonRef}
      type="button"
      variant="outline"
      aria-label={`View ${entity.name}`}
      className="h-[30px] w-fit max-w-full min-w-0 gap-[3px] overflow-hidden rounded-full border-primary/20 bg-primary/5 py-0 pl-[3px] pr-2 text-[13px] font-medium text-foreground hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        navigate(getEntityUrl(entity));
      }}
    >
      <EntityImage entity={entity} decorative className="h-[22px] w-[22px]" />
      <span ref={labelRef} className="min-w-0 truncate">
        {entity.name}
      </span>
    </Button>
  );

  if (!isTruncated) return pill;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{pill}</TooltipTrigger>
        <TooltipContent side="top">{entity.name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};