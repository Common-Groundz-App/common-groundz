
import { cn } from "@/lib/utils";
import React from "react";

interface MockupFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "small" | "medium" | "large";
  children: React.ReactNode;
}

export function MockupFrame({
  size = "medium",
  className,
  children,
  ...props
}: MockupFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background shadow-md",
        size === "small" && "max-w-3xl",
        size === "medium" && "max-w-4xl",
        size === "large" && "max-w-5xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface MockupProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "responsive" | "browser" | "phone";
  children: React.ReactNode;
}

export function Mockup({
  type = "responsive",
  className,
  children,
  ...props
}: MockupProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden",
        type === "browser" && "rounded-t-lg bg-muted pt-6",
        className
      )}
      {...props}
    >
      {type === "browser" && (
        <div className="mb-2 flex items-center gap-2 px-4">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
          <div className="h-6 w-full rounded-md bg-background px-2 text-xs text-muted-foreground">
            example.com
          </div>
        </div>
      )}
      <div className="relative w-full">{children}</div>
    </div>
  );
}
