
import React from 'react';
import { cn } from '@/lib/utils';

interface ConnectedRingsRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ConnectedRingsRating: React.FC<ConnectedRingsRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  className
}) => {
  const rings = Array.from({ length: maxRating }, (_, i) => i + 1);
  
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'h-4 w-4';
      case 'lg': return 'h-6 w-6';
      case 'md':
      default: return 'h-5 w-5';
    }
  };
  
  const getSpacingClass = () => {
    switch (size) {
      case 'sm': return '-ml-1';
      case 'lg': return '-ml-2';
      case 'md':
      default: return '-ml-1.5';
    }
  };
  
  return (
    <div className={cn("flex items-center", className)}>
      {rings.map((r) => (
        <div
          key={r}
          className={cn(
            "rounded-full border-2 flex items-center justify-center",
            r <= rating ? "border-brand-orange text-brand-orange" : "border-gray-200 text-gray-200",
            getSizeClass(),
            r > 1 ? getSpacingClass() : ""
          )}
        >
          {r <= rating && (
            <span className="block rounded-full bg-brand-orange"
              style={{
                width: '60%',
                height: '60%'
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default ConnectedRingsRating;
