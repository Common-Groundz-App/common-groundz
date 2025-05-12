
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
  const [animateRing, setAnimateRing] = useState<number | null>(null);
  
  const sizeConfig = {
    sm: {
      svgSize: 150,
      ringSize: 20,
      strokeWidth: 4,
      textClass: 'text-xs',
      textOffset: 30,
      overlapOffset: 15
    },
    md: {
      svgSize: 200,
      ringSize: 28,
      strokeWidth: 4.5,
      textClass: 'text-sm',
      textOffset: 40,
      overlapOffset: 20
    },
    lg: {
      svgSize: 250,
      ringSize: 36,
      strokeWidth: 5,
      textClass: 'text-base',
      textOffset: 50,
      overlapOffset: 25
    }
  };
  
  const { ringSize, strokeWidth, textClass, overlapOffset } = sizeConfig[size];
  const effectiveRating = hoverRating || value;
  const isCertified = value >= 4.5;
  
  // Calculate the actual width needed to display all 5 rings properly with even padding
  const calculateSvgWidth = () => {
    // Calculate the total width needed for 5 rings with overlap
    const totalRingsWidth = ((ringSize * 2) * 5) - (overlapOffset * 4);
    
    // Add equal padding on both sides
    const sidePadding = ringSize;
    
    return totalRingsWidth + (sidePadding * 2);
  };
  
  // Calculate the viewBox size dynamically
  const svgWidth = calculateSvgWidth();
  const svgHeight = sizeConfig[size].svgSize;
  
  // Calculate positions for the 5 interlinking rings with centered distribution
  const calculateRingPositions = () => {
    const rings = [];
    const verticalCenter = svgHeight / 2;
    
    // Calculate the total width of all 5 rings with overlap
    const totalRingsWidth = ((ringSize * 2) * 5) - (overlapOffset * 4);
    
    // Calculate the starting position to center the rings within the SVG
    const startX = (svgWidth - totalRingsWidth) / 2 + ringSize;
    
    let horizontalPosition = startX;
    
    // Create 5 rings in a row with overlap, centered in the SVG
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

  // Get sentiment color based on rating
  const getSentimentColor = (rating: number) => {
    if (rating < 2) return "#ea384c"; // Red for 1.0-1.9
    if (rating < 3) return "#F97316"; // Orange for 2.0-2.9
    if (rating < 4) return "#FEC006"; // Yellow for 3.0-3.9
    if (rating < 4.5) return "#84cc16"; // Light green for 4.0-4.4
    return "#22c55e"; // Green for 4.5-5.0
  };
  
  // Get sentiment gradient ID based on rating
  const getSentimentGradientId = (rating: number) => {
    if (rating < 2) return "sentimentGradientRed";
    if (rating < 3) return "sentimentGradientOrange";
    if (rating < 4) return "sentimentGradientYellow";
    if (rating < 4.5) return "sentimentGradientLightGreen";
    return "sentimentGradientGreen";
  };

  // Get emoji and text based on rating
  const getRatingText = (rating: number) => {
    if (rating === 0) return "Tap to rate";
    if (rating < 2) return "Didn't like it 😕";
    if (rating < 3) return "Below average 😐";
    if (rating < 4) return "It was okay 🙂";
    if (rating < 4.5) return "Liked it 😄";
    return "Loved it! 🤩";
  };
  
  // Get emoji only based on rating
  const getRatingEmoji = (rating: number) => {
    if (rating < 2) return "😕";
    if (rating < 3) return "😐";
    if (rating < 4) return "🙂";
    if (rating < 4.5) return "😄";
    return "🤩";
  };
  
  // Handle ring click with animation
  const handleRingClick = (ringValue: number) => {
    if (isInteractive && onChange) {
      setAnimateRing(ringValue);
      onChange(ringValue);
      
      // Reset animation state after animation completes
      setTimeout(() => {
        setAnimateRing(null);
      }, 500);
    }
  };

  // Calculate the stroke dasharray and dashoffset for animated rings
  const calculateStrokeDashArray = (radius: number) => {
    const circumference = 2 * Math.PI * radius;
    return circumference;
  };

  const sentimentColor = getSentimentColor(effectiveRating);
  
  // Define colors for inactive rings based on whether a selection has been made
  const defaultInactiveColor = "#999"; // Medium gray for initial state
  const selectedInactiveColor = "#ddd"; // Lighter gray after selection
  
  // Use the appropriate inactive color based on whether a value has been selected
  const inactiveRingColor = value > 0 ? selectedInactiveColor : defaultInactiveColor;

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col items-center w-full", className)}>
        {/* Center the SVG container horizontally with proper alignment */}
        <div className="w-full flex justify-center">
          <div
            className={cn(
              "relative flex justify-center",
              isInteractive && "cursor-pointer",
              isCertified && "animate-pulse"
            )}
            onMouseLeave={() => isInteractive && setHoverRating(0)}
          >
            <svg
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="transform transition-transform duration-300"
              style={{ overflow: 'visible' }}
            >
              {/* Gradient definitions for sentiment colors */}
              <defs>
                <linearGradient id="sentimentGradientRed" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ea384c" />
                  <stop offset="100%" stopColor="#f87171" />
                </linearGradient>
                <linearGradient id="sentimentGradientOrange" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#FB923C" />
                </linearGradient>
                <linearGradient id="sentimentGradientYellow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FEC006" />
                  <stop offset="100%" stopColor="#FEF08A" />
                </linearGradient>
                <linearGradient id="sentimentGradientLightGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#bef264" />
                </linearGradient>
                <linearGradient id="sentimentGradientGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#86efac" />
                </linearGradient>
              </defs>
              
              {/* Interlinking donut rings */}
              {ringPositions.map((ring, i) => {
                const isActive = effectiveRating >= ring.value;
                const ringRadius = ringSize - strokeWidth / 2;
                const circumference = calculateStrokeDashArray(ringRadius);
                const activePercentage = isActive ? 100 : 0;
                const dashOffset = circumference - (circumference * activePercentage) / 100;
                const isAnimating = animateRing === ring.value;
                
                return (
                  <Tooltip key={`ring-${i}`}>
                    <TooltipTrigger asChild>
                      <g 
                        className={cn(
                          "transition-all duration-300 hover:scale-105 group",
                          isAnimating && "animate-[bounce_0.5s_ease-in-out]"
                        )}
                        onMouseEnter={() => isInteractive && setHoverRating(ring.value)}
                        onClick={() => handleRingClick(ring.value)}
                      >
                        {/* Ring outline (always visible) */}
                        <circle
                          cx={ring.cx}
                          cy={ring.cy}
                          r={ringRadius}
                          stroke={isActive ? sentimentColor : inactiveRingColor}
                          strokeWidth={strokeWidth}
                          fill="transparent"
                          className="transition-all duration-300"
                        />
                        
                        {/* Animated fill stroke */}
                        <circle
                          cx={ring.cx}
                          cy={ring.cy}
                          r={ringRadius}
                          stroke={`url(#${getSentimentGradientId(effectiveRating)})`}
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
                            stroke={sentimentColor}
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
            </svg>

            {/* Circle Certified Badge - show only for high ratings */}
            {isCertified && (
              <div className="absolute -right-2 -top-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                Circle Certified
              </div>
            )}
          </div>
        </div>
        
        {/* Rating value and text */}
        <div className="mt-2 flex flex-col items-center">
          {showValue && (
            <span className={cn("font-bold", textClass)}>
              <span className="mr-1" style={{ color: sentimentColor }}>{value.toFixed(1)}</span>
              <span className="text-brand-orange">•</span> 
              <span className="text-muted-foreground font-normal ml-1">Groundz Score</span>
            </span>
          )}
          
          {showLabel && (
            <div 
              className={cn(
                "text-center mt-1 transition-all duration-300 flex items-center gap-1", 
                textClass
              )}
              style={{ color: sentimentColor }}
            >
              <span className="text-lg">{getRatingEmoji(Math.round(effectiveRating))}</span>
              <span>{getRatingText(Math.round(effectiveRating)).split(' ').slice(0, -1).join(' ')}</span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ConnectedRingsRating;
