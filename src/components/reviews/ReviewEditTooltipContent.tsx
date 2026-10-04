import type { ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { TooltipContent } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

/** Portalled only for review Edit actions so the menu cannot clip the explanation. */
export function ReviewEditTooltipContent({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <TooltipPrimitive.Portal>
      <TooltipContent
        side={isMobile ? 'top' : 'left'}
        align="center"
        collisionPadding={12}
        className="pointer-events-none z-[101] max-w-[calc(100vw-24px)] whitespace-normal break-words text-center"
      >
        {children}
      </TooltipContent>
    </TooltipPrimitive.Portal>
  );
}