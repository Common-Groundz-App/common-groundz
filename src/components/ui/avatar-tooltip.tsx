import React, { useState, useEffect } from 'react';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface AvatarTooltipProps {
  userId: string;
  content: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent) => void;
}

export const AvatarTooltip: React.FC<AvatarTooltipProps> = ({ 
  userId,
  content,
  size = 'sm',
  side = 'top',
  className,
  style,
  onClick
}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Auto-dismiss on mobile after 4 seconds
  useEffect(() => {
    if (isMobile && open) {
      const timer = setTimeout(() => {
        setOpen(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isMobile, open]);

  const avatarElement = (
    <div 
      className={cn("cursor-pointer transition-transform hover:scale-105", className)}
      style={style}
      onClick={onClick}
    >
      <ProfileAvatar 
        userId={userId} 
        size={size}
        showSkeleton={false}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {avatarElement}
        </PopoverTrigger>
        <PopoverContent 
          side={side} 
          sideOffset={10}
          avoidCollisions={true}
          className={cn("max-w-[280px] z-50 bg-popover border shadow-md")}
        >
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {avatarElement}
      </TooltipTrigger>
      <TooltipContent 
        side={side} 
        sideOffset={10}
        avoidCollisions={true}
        className={cn("max-w-[280px] z-50")}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
};