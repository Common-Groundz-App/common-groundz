
import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { useThemedClass } from '@/utils/theme-utils';

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
      textClass: 'text-xs',
      textOffset: 30,
      overlapOffset: 15
    },
    md: {
      svgSize: 200,
      ringSize: 28,
      textClass: 'text-sm',
      textOffset: 40,
      overlapOffset: 20
    },
    lg: {
      svgSize: 250,
      ringSize: 36,
      textClass: 'text-base',
      textOffset: 50,
      overlapOffset: 25
    }
  };
  
  const { svgSize, ringSize, textClass, overlapOffset } = sizeConfig[size];
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

  return (
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
          className="transform transition-transform duration-300 hover:scale-105"
        >
          {/* Interlinking rings */}
          {ringPositions.map((ring, i) => {
            const isActive = effectiveRating >= ring.value;
            
            return (
              <g 
                key={`ring-${i}`} 
                className="transition-all duration-300"
                onMouseEnter={() => isInteractive && setHoverRating(ring.value)}
                onClick={() => handleRingClick(ring.value)}
              >
                {/* Ring outline */}
                <circle
                  cx={ring.cx}
                  cy={ring.cy}
                  r={ringSize}
                  stroke={isActive ? "#F97316" : "gray"}
                  strokeWidth="2"
                  fill="transparent"
                  className="transition-all duration-300"
                />
                
                {/* Ring fill with gradient */}
                <circle
                  cx={ring.cx}
                  cy={ring.cy}
                  r={ringSize - 2}
                  fill={`url(#${isActive ? 'activeGradient' : 'inactiveGradient'})`}
                  fillOpacity={isActive ? "0.9" : "0.2"}
                  className="transition-all duration-300"
                />
                
                {/* Ring number */}
                <text
                  x={ring.cx}
                  y={ring.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isActive ? "white" : "currentColor"}
                  className={cn(
                    "font-bold transition-all duration-300",
                    size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
                  )}
                >
                  {ring.value}
                </text>
              </g>
            );
          })}
          
          {/* Gradients definitions */}
          <defs>
            <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#FB923C" />
            </linearGradient>
            <linearGradient id="inactiveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d1d5db" />
              <stop offset="100%" stopColor="#e5e7eb" />
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
  );
};

export default ConnectedRingsRating;
