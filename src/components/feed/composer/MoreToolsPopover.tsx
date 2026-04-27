import React from 'react';
import { MoreHorizontal, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MoreToolsPopoverProps {
  onOpenLocation: () => void;
  disabled?: boolean;
  locationActive?: boolean;
}

/**
 * Secondary toolbar (Level 2). Houses lower-frequency tools.
 * Currently: Location. Designed to grow without crowding Level 1.
 */
export const MoreToolsPopover: React.FC<MoreToolsPopoverProps> = ({
  onOpenLocation,
  disabled,
  locationActive,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full p-2 hover:bg-accent hover:text-accent-foreground"
          disabled={disabled}
          aria-label="More tools"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        <button
          type="button"
          onClick={onOpenLocation}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left transition-colors',
            locationActive && 'bg-accent/50'
          )}
        >
          <MapPin className="h-4 w-4" />
          <span>Add location</span>
        </button>
      </PopoverContent>
    </Popover>
  );
};
