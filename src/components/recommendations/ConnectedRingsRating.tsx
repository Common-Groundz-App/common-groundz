
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
  const isReadOnly = !onChange;
  
  const sizeConfig = {
    sm: {
      svgSize: 120,
      textClass: 'text-xs',
      ringSize: 12,
      spacing: 1,
      textOffset: 25
    },
    md: {
      svgSize: 180,
      textClass: 'text-sm',
      ringSize: 18,
      spacing: 2,
      textOffset: 35
    },
    lg: {
      svgSize: 240,
      textClass: 'text-base',
      ringSize: 24,
      spacing: 3,
      textOffset: 45
    }
  };
  
  const { svgSize, textClass, ringSize, spacing, textOffset } = sizeConfig[size];
  const effectiveRating = hoverRating || value;
  const bgClass = useThemedClass('bg-gradient-to-r from-amber-50 to-orange-50', 'bg-gradient-to-r from-orange-950/30 to-amber-950/30');
  
  const getRatingText = (rating: number) => {
    if (rating === 0) return "Tap to rate";
    if (rating === 5) return "Loved it! 😍";
    if (rating === 4) return "Really good 👍";
    if (rating === 3) return "It's okay 😊";
    if (rating === 2) return "Not great 😐";
    return "Didn't like it 😕";
  };
  
  const isCertified = value >= 4.5;

  // Calculate positions for the 5 rings
  const calculateRingPositions = () => {
    const center = svgSize / 2;
    const radius = center - ringSize - spacing;
    
    // Calculate positions in a circular pattern
    const rings = [];
    
    // First ring at the center
    rings.push({ cx: center, cy: center });
    
    // Calculate positions for 4 rings around the center
    const angleStep = (2 * Math.PI) / 4; // Divide the circle into 4 parts
    for (let i = 0; i < 4; i++) {
      const angle = i * angleStep;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      rings.push({ cx: x, cy: y });
    }
    
    return rings;
  };
  
  const ringPositions = calculateRingPositions();
  
  // Generate connection lines between rings
  const generateConnections = () => {
    const connections = [];
    const centerRingIndex = 0;
    
    // Connect center ring to all other rings
    for (let i = 1; i < ringPositions.length; i++) {
      connections.push({
        x1: ringPositions[centerRingIndex].cx,
        y1: ringPositions[centerRingIndex].cy,
        x2: ringPositions[i].cx,
        y2: ringPositions[i].cy,
      });
    }
    
    // Connect outer rings to each other in a circular pattern
    for (let i = 1; i < ringPositions.length; i++) {
      const nextIndex = i === ringPositions.length - 1 ? 1 : i + 1;
      connections.push({
        x1: ringPositions[i].cx,
        y1: ringPositions[i].cy,
        x2: ringPositions[nextIndex].cx,
        y2: ringPositions[nextIndex].cy,
      });
    }
    
    return connections;
  };
  
  const connections = generateConnections();

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
          {/* Connection lines */}
          {connections.map((conn, i) => (
            <line
              key={`conn-${i}`}
              x1={conn.x1}
              y1={conn.y1}
              x2={conn.x2}
              y2={conn.y2}
              stroke={`url(#${effectiveRating >= (i % 4) + 2 ? 'activeGradient' : 'inactiveGradient'})`}
              strokeWidth={spacing * 2}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          ))}
          
          {/* Rings */}
          {ringPositions.map((pos, i) => {
            const ringValue = i === 0 ? 1 : i + 1; // Center is 1, then 2-5 clockwise
            const isActive = effectiveRating >= ringValue;
            
            return (
              <g key={`ring-${i}`} className="transition-all duration-300">
                {/* Outer circle (always visible) */}
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={ringSize}
                  stroke={isActive ? "#F97316" : "gray"}
                  strokeWidth="1.5"
                  fill="transparent"
                  className="transition-all duration-300"
                />
                
                {/* Inner filled circle (visible when active) */}
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={ringSize - 2}
                  fill={`url(#${isActive ? 'activeGradient' : 'inactiveGradient'})`}
                  className={cn(
                    "transition-all duration-300",
                    !isActive && "opacity-40"
                  )}
                  onMouseEnter={() => isInteractive && setHoverRating(ringValue)}
                  onClick={() => handleRingClick(ringValue)}
                />
                
                {/* Ring number */}
                <text
                  x={pos.cx}
                  y={pos.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isActive ? "white" : "currentColor"}
                  className={cn(
                    "font-bold transition-all duration-300",
                    size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
                  )}
                >
                  {ringValue}
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
