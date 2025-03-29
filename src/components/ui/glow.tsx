
import { cn } from "@/lib/utils";
import React from "react";

interface GlowProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "top" | "bottom" | "left" | "right" | "center";
  color?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Glow({
  variant = "center",
  color,
  size = "lg",
  className,
  ...props
}: GlowProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden",
        variant === "top" && "-top-1/2",
        variant === "bottom" && "-bottom-1/2",
        variant === "left" && "-left-1/2 h-full",
        variant === "right" && "-right-1/2 h-full",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "absolute aspect-square rounded-full bg-brand-orange/30 blur-[150px]",
          size === "sm" && "h-32",
          size === "md" && "h-64",
          size === "lg" && "h-96",
          size === "xl" && "h-[32rem]",
          variant === "top" && "left-1/2 top-0 -translate-x-1/2",
          variant === "bottom" && "bottom-0 left-1/2 -translate-x-1/2",
          variant === "left" && "left-0 top-1/2 -translate-y-1/2",
          variant === "right" && "right-0 top-1/2 -translate-y-1/2",
          variant === "center" && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={{
          backgroundColor: color,
        }}
      />
    </div>
  );
}
