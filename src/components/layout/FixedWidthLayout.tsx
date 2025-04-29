
import { cn } from "@/lib/utils";
import React from "react";

interface FixedWidthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function FixedWidthLayout({ children, className }: FixedWidthLayoutProps) {
  return (
    <div className={cn(
      "w-full max-w-screen-xl mx-auto flex",
      className
    )}>
      {children}
    </div>
  );
}
