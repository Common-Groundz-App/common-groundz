
import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { useThemedClass } from '@/utils/theme-utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectedRingsRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
  isInteractive?: boolean;
  showLabel?: boolean;
}

const ConnectedRingsRating = ({ 
  value, 
  onChange,
  size = 'md',
  showValue = true,
  className,
  isInteractive = false,
  showLabel = false
}: ConnectedRingsRatingProps) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  const sizeConfig = {
    sm: {
      svgSize: 150,
      ringSize: 20,
      strokeWidth: 2.5,
      textClass: 'text-xs',
      textOffset: 30,
      overlapOffset: 15
    },
    md: {
      svgSize: 200,
      ringSize: 28,
      strokeWidth: 3,
      textClass: 'text-sm',
      textOffset: 40,
      overlapOffset: 20
    },
    lg: {
      svgSize: 250,
      ringSize: 36,
      strokeWidth: 3.5,
      textClass: 'text-base',
      textOffset: 50,
      overlapOffset: 25
    }
  };
  
  const { svgSize, ringSize, strokeWidth, textClass, overlapOffset } = sizeConfig[size];
  const effectiveRating = hoverRating || value;
  const isCertified = value >= 4.5;
  
  // Calculate positions for the 5 interlinking rings in a row
  const calculateRingPositions = () => {
    const rings = [];
    const verticalCenter = svgSize / 2;
    // Start position from the left with some padding
    let horizontalPosition = ringSize + 10;
    
    // Create 5 rings in a row with overlap
    for (let i = 0; i < 5; i++) {
      rings.push({
        cx: horizontalPosition,
        cy: verticalCenter,
        value: i + 1 // Rating value 1-5
      });
      // Move horizontally with overlap
      horizontalPosition += (ringSize * 2) - overlapOffset;
    }
    
    return rings;
  };
  
  const ringPositions = calculateRingPositions();

  const getRatingText = (rating: number) => {
    if (rating === 0) return "Tap to rate";
    if (rating === 5) return "Loved it! 😍";
    if (rating === 4) return "Really good 👍";
    if (rating === 3) return "It's okay 😊";
    if (rating === 2) return "Not great 😐";
    return "Didn't like it 😕";
  };
  
  // Handle ring click
  const handleRingClick = (ringValue: number) => {
    if (isInteractive && onChange) {
      onChange(ringValue);
    }
  };

  // Calculate the stroke dasharray and dashoffset for animated rings
  const calculateStrokeDashArray = (radius: number) => {
    const circumference = 2 * Math.PI * radius;
    return circumference;
  };

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col items-center", className)}>
        <div
          className={cn(
            "relative",
            isInteractive && "cursor-pointer",
            isCertified && "animate-pulse"
          )}
          onMouseLeave={() => isInteractive && setHoverRating(0)}
        >
          <svg
            width={svgSize}
            height={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className="transform transition-transform duration-300"
          >
            {/* Interlinking donut rings */}
            {ringPositions.map((ring, i) => {
              const isActive = effectiveRating >= ring.value;
              const ringRadius = ringSize - strokeWidth / 2;
              const circumference = calculateStrokeDashArray(ringRadius);
              const activePercentage = isActive ? 100 : 0;
              const dashOffset = circumference - (circumference * activePercentage) / 100;
              
              return (
                <Tooltip key={`ring-${i}`}>
                  <TooltipTrigger asChild>
                    <g 
                      className="transition-all duration-300 hover:scale-105 group"
                      onMouseEnter={() => isInteractive && setHoverRating(ring.value)}
                      onClick={() => handleRingClick(ring.value)}
                    >
                      {/* Ring outline (always visible) */}
                      <circle
                        cx={ring.cx}
                        cy={ring.cy}
                        r={ringRadius}
                        stroke={isActive ? "#F97316" : "gray"}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        className="transition-all duration-300"
                      />
                      
                      {/* Animated fill stroke */}
                      <circle
                        cx={ring.cx}
                        cy={ring.cy}
                        r={ringRadius}
                        stroke="url(#activeGradient)"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={isActive ? 0 : circumference}
                        strokeLinecap="round"
                        className="transition-all duration-500 ease-out"
                        style={{ 
                          transform: 'rotate(-90deg)', 
                          transformOrigin: `${ring.cx}px ${ring.cy}px`,
                          opacity: isActive ? 1 : 0
                        }}
                      />
                      
                      {/* Hover glow effect */}
                      {isInteractive && (
                        <circle
                          cx={ring.cx}
                          cy={ring.cy}
                          r={ringRadius + 2}
                          stroke="#F97316"
                          strokeWidth={2}
                          fill="transparent"
                          opacity="0"
                          className="group-hover:opacity-30 transition-opacity duration-300"
                        />
                      )}
                    </g>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-popover/90 backdrop-blur-sm">
                    {getRatingText(ring.value)}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            
            {/* Gradients definitions */}
            <defs>
              <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#FB923C" />
              </linearGradient>
            </defs>
          </svg>

          {/* Circle Certified Badge - show only for high ratings */}
          {isCertified && (
            <div className="absolute -right-2 -top-2 bg-gradient-to-r from-brand-orange to-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
              Circle Certified
            </div>
          )}
        </div>
        
        {/* Rating value and text */}
        <div className="mt-2 flex flex-col items-center">
          {showValue && (
            <span className={cn("font-bold", textClass)}>
              {value.toFixed(1)}
              <span className="text-brand-orange ml-1">•</span> 
              <span className="text-muted-foreground font-normal ml-1">Groundz Score</span>
            </span>
          )}
          
          {showLabel && isInteractive && (
            <span className={cn("text-center mt-1", textClass)}>
              {getRatingText(Math.round(effectiveRating))}
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ConnectedRingsRating;
