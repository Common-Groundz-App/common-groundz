import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport 
      className="h-full w-full rounded-[inherit]"
      onScroll={(e) => {
        // Allow scrolling within emoji picker components to work
        const target = e.target as HTMLElement;
        if (target.closest('.emoji-mart') || 
            target.closest('.emoji-mart-emoji') || 
            target.closest('.emoji-picker-wrapper')) {
          return;
        }
        
        // Otherwise ensure scrolling doesn't propagate beyond this component
        if (e.target !== e.currentTarget) {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        // Allow clicks on emoji picker components
        const target = e.target as HTMLElement;
        if (target.closest('.emoji-mart') || 
            target.closest('.emoji-mart-emoji') || 
            target.closest('.emoji-picker-wrapper')) {
          return;
        }
        
        // Prevent click events from propagating through the scroll area
        if (e.target === e.currentTarget) {
          e.stopPropagation();
        }
      }}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
