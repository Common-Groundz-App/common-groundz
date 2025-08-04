import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ClaimedBadgeTooltipProps {
  isClaimed: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export const ClaimedBadgeTooltip: React.FC<ClaimedBadgeTooltipProps> = ({ 
  isClaimed,
  side = 'bottom' 
}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const content = isClaimed 
    ? "This listing is actively managed by the owner." 
    : "This listing hasn't been claimed yet. Claim it for free to update info, add photos, respond to reviews, and more.";

  const badgeElement = (
    <Badge 
      variant="secondary" 
      className={cn(
        "cursor-pointer transition-colors",
        isClaimed 
          ? "bg-green-100 text-green-800 hover:bg-green-200" 
          : "bg-muted text-muted-foreground hover:bg-muted/80",
        isMobile && "active:bg-opacity-80"
      )}
    >
      {isClaimed ? (
        <CheckCircle className="w-3 h-3 mr-1" />
      ) : (
        <AlertTriangle className="w-3 h-3 mr-1" />
      )}
      {isClaimed ? 'Claimed' : 'Unclaimed'}
    </Badge>
  );

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
          {badgeElement}
        </PopoverTrigger>
        <PopoverContent 
          side={side} 
          sideOffset={10}
          avoidCollisions={true}
          className={cn("max-w-xs z-50 bg-popover border shadow-md")}
        >
          <p className="text-sm">
            {content}
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badgeElement}
      </TooltipTrigger>
      <TooltipContent 
        side={side} 
        className="bg-popover text-popover-foreground border rounded-md shadow-md p-3 max-w-xs"
      >
        <p className="text-sm">
          {content}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};