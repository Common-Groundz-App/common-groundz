
import React from "react";
import { cn } from "@/lib/utils";

interface GlowProps {
  variant?: "bottom" | "top";
  className?: string;
}

export const Glow = ({ variant = "bottom", className }: GlowProps) => {
  return (
    <div
      className={cn(
        "absolute pointer-events-none",
        variant === "bottom" 
          ? "bottom-0 left-0 right-0 h-[300px] -mb-32" 
          : "top-0 left-0 right-0 h-[300px] -mt-32",
        className
      )}
    >
      <div 
        className={cn(
          "absolute inset-0 opacity-60",
          variant === "bottom" 
            ? "bg-gradient-to-t from-brand-orange/30 via-brand-orange/10 to-transparent" 
            : "bg-gradient-to-b from-brand-orange/30 via-brand-orange/10 to-transparent"
        )}
      />
    </div>
  );
};
