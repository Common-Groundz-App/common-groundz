import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ClaimedBadgeTooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export const ClaimedBadgeTooltip: React.FC<ClaimedBadgeTooltipProps> = ({ 
  content, 
  children,
  side = 'top' 
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

  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="cursor-pointer touch-manipulation">
            {children}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          side={side} 
          sideOffset={10}
          avoidCollisions={true}
          className={cn("max-w-[280px] z-50 bg-popover border shadow-md")}
        >
          <p className="whitespace-pre-line text-sm">
            {content}
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent 
        side={side} 
        sideOffset={10}
        avoidCollisions={true}
        className={cn("max-w-[280px] z-50")}
      >
        <p className="whitespace-pre-line">
          {content}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};