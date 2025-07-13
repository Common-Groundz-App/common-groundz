
import React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface InfoTooltipProps {
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  content, 
  side = 'top' 
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
      </TooltipTrigger>
      <TooltipContent 
        side={side} 
        sideOffset={10}
        avoidCollisions={true}
        className="bg-popover text-popover-foreground border rounded-md shadow-md p-3 max-w-sm z-50"
      >
        <p className="text-sm whitespace-normal">
          {content}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
