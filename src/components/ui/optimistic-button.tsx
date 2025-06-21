
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptimisticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isOptimistic?: boolean;
  optimisticText?: string;
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const OptimisticButton: React.FC<OptimisticButtonProps> = ({
  isOptimistic = false,
  optimisticText,
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <Button
      {...props}
      disabled={disabled || isOptimistic}
      className={cn(
        'transition-all duration-200',
        isOptimistic && 'animate-pulse',
        className
      )}
    >
      {isOptimistic ? (
        <div className="flex items-center gap-2">
          <Loader className="h-4 w-4 animate-spin" />
          {optimisticText || 'Processing...'}
        </div>
      ) : (
        children
      )}
    </Button>
  );
};
